import { corsHeaders, json, adminClient, auditPayment } from "../_shared/payments.ts";

const YOCO_CHARGE_URL = "https://online.yoco.com/v1/charges/";

// Constant-time comparison of the presented bearer token against the
// project's service-role key. verify_jwt=true on this function makes the
// gateway reject unsigned/invalid JWTs before we get here; this final
// check ensures only callers holding the real service-role secret (i.e.
// billing-cron, yoco-save-card, admin retries) may trigger a card charge.
function isServiceRoleToken(token: string): boolean {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !secret || token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

async function chargeCard(secretKey: string, token: string, amountCents: number, currency: string) {
  const res = await fetch(YOCO_CHARGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Secret-Key": secretKey },
    body: JSON.stringify({ token, amountInCents: amountCents, currency }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function addPeriod(from: Date, cycle: string): Date {
  const d = new Date(from);
  if (cycle === "ANNUAL") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// Charges a single organization's subscription for the current period.
// Called by billing-cron, yoco-save-card (first charge), or a manual retry.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authorization: only trusted service-role callers (billing-cron,
    // yoco-save-card, admin retries) may trigger a card charge. Reject any
    // request that does not present a service-role token.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!isServiceRoleToken(token)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { organizationId, invoiceId } = await req.json();
    const admin = adminClient();
    const secretKey = Deno.env.get("YOCO_SECRET_KEY");

    // Load subscription + plan + default card
    const { data: sub } = await admin
      .from("organization_subscriptions").select("*").eq("organization_id", organizationId).maybeSingle();
    if (!sub) return json({ error: "No subscription" }, 404);
    if ((sub as any).is_custom) return json({ skipped: "custom plan" });

    const { data: plan } = await admin
      .from("subscription_plans").select("*").eq("id", (sub as any).plan_id).maybeSingle();
    if (!plan) return json({ error: "No plan" }, 404);
    if ((plan as any).is_custom) return json({ skipped: "custom plan - contact sales" });

    const { data: card } = await admin
      .from("payment_methods").select("*")
      .eq("organization_id", organizationId).eq("is_default", true)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const cycle = (sub as any).billing_cycle;
    const amount = cycle === "ANNUAL" ? Number((plan as any).price_annual) : Number((plan as any).price_monthly);
    const currency = (plan as any).currency || "ZAR";

    // Create or reuse invoice
    let invoice: any;
    if (invoiceId) {
      const { data } = await admin.from("subscription_invoices").select("*").eq("id", invoiceId).maybeSingle();
      invoice = data;
    }
    if (!invoice) {
      const now = new Date();
      const periodEnd = addPeriod(now, cycle);
      const { data: inv, error: invErr } = await admin.from("subscription_invoices").insert({
        organization_id: organizationId,
        subscription_id: (sub as any).id,
        plan_id: (plan as any).id,
        invoice_number: `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`,
        amount, currency, status: "OPEN",
        period_start: now.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        due_date: now.toISOString().slice(0, 10),
      }).select().single();
      if (invErr) throw invErr;
      invoice = inv;
    }

    // Determine attempt number
    const { count } = await admin
      .from("subscription_payment_attempts").select("id", { count: "exact", head: true }).eq("invoice_id", invoice.id);
    const attemptNo = (count ?? 0) + 1;

    if (!secretKey || !card) {
      const reason = !secretKey ? "YOCO_SECRET_KEY not configured" : "No card on file";
      await admin.from("subscription_payment_attempts").insert({
        organization_id: organizationId, invoice_id: invoice.id, attempt_no: attemptNo,
        status: "FAILED", error_message: reason,
        next_retry_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      await admin.from("subscription_invoices").update({ status: "FAILED" }).eq("id", invoice.id);
      await admin.from("organization_subscriptions").update({ status: "PAST_DUE" }).eq("id", (sub as any).id);
      return json({ success: false, error: reason }, 200);
    }

    // Charge via Yoco
    const result = await chargeCard(secretKey, (card as any).provider_token, Math.round(amount * 100), currency);

    if (result.ok) {
      const now = new Date();
      const periodEnd = addPeriod(now, cycle);
      await admin.from("subscription_invoices").update({
        status: "PAID", paid_at: now.toISOString(), yoco_charge_id: result.body?.id ?? null,
      }).eq("id", invoice.id);
      await admin.from("subscription_payment_attempts").insert({
        organization_id: organizationId, invoice_id: invoice.id, attempt_no: attemptNo, status: "SUCCESS",
      });
      await admin.from("organization_subscriptions").update({
        status: "ACTIVE",
        current_period_start: now.toISOString().slice(0, 10),
        current_period_end: periodEnd.toISOString().slice(0, 10),
        next_billing_date: periodEnd.toISOString().slice(0, 10),
      }).eq("id", (sub as any).id);
      await auditPayment(admin, {
        organization_id: organizationId, invoice_id: invoice.id, action: "SUBSCRIPTION_CHARGED",
        new_status: "PAID", amount, notes: `Yoco charge ${result.body?.id ?? ""}`.trim(),
      });
      return json({ success: true, chargeId: result.body?.id });
    }

    // Failed charge -> schedule retry (max 3 attempts, exponential backoff)
    const errMsg = result.body?.displayMessage || result.body?.message || `Charge failed (${result.status})`;
    const backoffHours = [24, 72, 168][Math.min(attemptNo - 1, 2)];
    const willRetry = attemptNo < 3;
    await admin.from("subscription_payment_attempts").insert({
      organization_id: organizationId, invoice_id: invoice.id, attempt_no: attemptNo,
      status: "FAILED", error_message: errMsg,
      next_retry_at: willRetry ? new Date(Date.now() + backoffHours * 3600 * 1000).toISOString() : null,
    });
    await admin.from("subscription_invoices").update({ status: "FAILED" }).eq("id", invoice.id);
    await admin.from("organization_subscriptions").update({ status: "PAST_DUE" }).eq("id", (sub as any).id);
    await auditPayment(admin, {
      organization_id: organizationId, invoice_id: invoice.id, action: "SUBSCRIPTION_CHARGE_FAILED",
      new_status: "FAILED", amount, notes: errMsg,
    });
    return json({ success: false, error: errMsg, willRetry });
  } catch (e) {
    console.error("yoco-charge-subscription error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
