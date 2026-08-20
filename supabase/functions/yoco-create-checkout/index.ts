import { corsHeaders, json, adminClient, getAuthContext } from "../_shared/payments.ts";

const YOCO_CHECKOUT_URL = "https://payments.yoco.com/api/checkouts";

// The Yoco secret key lives in YOCO_SECRET_KEY. STRIPE_TEST_API_KEY is a legacy
// slot that currently holds the Yoco test secret key.
function yocoSecret(): string | undefined {
  return Deno.env.get("YOCO_SECRET_KEY") ?? Deno.env.get("STRIPE_TEST_API_KEY") ?? undefined;
}

// Creates a Yoco hosted checkout for the selected plan and returns the redirect URL.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secretKey = yocoSecret();
    if (!secretKey) return json({ error: "Yoco secret key not configured" }, 503);

    const { userId, orgId } = await getAuthContext(req);
    if (!userId || !orgId) return json({ error: "Unauthorized" }, 401);

    const admin = adminClient();
    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "ADMIN").maybeSingle();
    if (!role) return json({ error: "Only administrators can manage billing" }, 403);

    const { planId, cycle = "MONTHLY", returnUrl } = await req.json();
    if (!planId) return json({ error: "Missing planId" }, 400);

    const { data: plan } = await admin
      .from("subscription_plans").select("*").eq("id", planId).maybeSingle();
    if (!plan) return json({ error: "Plan not found" }, 404);
    if ((plan as any).is_custom) return json({ error: "Custom plans are billed manually" }, 400);

    const amount = cycle === "ANNUAL" ? Number((plan as any).price_annual) : Number((plan as any).price_monthly);
    const currency = (plan as any).currency || "ZAR";
    const amountCents = Math.round(amount * 100);

    // Ensure a subscription row exists and points at the chosen plan
    const { data: existingSub } = await admin
      .from("organization_subscriptions").select("id").eq("organization_id", orgId).maybeSingle();
    let subscriptionId = (existingSub as any)?.id ?? null;
    if (subscriptionId) {
      await admin.from("organization_subscriptions")
        .update({ plan_id: planId, billing_cycle: cycle, cancel_at_period_end: false })
        .eq("id", subscriptionId);
    } else {
      const { data: created } = await admin.from("organization_subscriptions").insert({
        organization_id: orgId, plan_id: planId, billing_cycle: cycle, status: "INCOMPLETE",
      }).select("id").single();
      subscriptionId = (created as any)?.id ?? null;
    }

    // Open invoice for this checkout
    const now = new Date();
    const periodEnd = new Date(now);
    if (cycle === "ANNUAL") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data: invoice, error: invErr } = await admin.from("subscription_invoices").insert({
      organization_id: orgId,
      subscription_id: subscriptionId,
      plan_id: planId,
      invoice_number: `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`,
      amount, currency, status: "OPEN",
      period_start: now.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      due_date: now.toISOString().slice(0, 10),
    }).select().single();
    if (invErr) throw invErr;

    const base = (returnUrl || req.headers.get("origin") || "").replace(/\/$/, "");
    const res = await fetch(YOCO_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": (invoice as any).id,
      },
      body: JSON.stringify({
        amount: amountCents,
        currency,
        successUrl: `${base}/billing?checkout=success&invoice=${(invoice as any).id}`,
        cancelUrl: `${base}/billing?checkout=cancelled`,
        failureUrl: `${base}/billing?checkout=failed`,
        metadata: {
          organizationId: orgId,
          invoiceId: (invoice as any).id,
          planId,
          cycle,
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("yoco checkout create failed", res.status, body);
      await admin.from("subscription_invoices").update({ status: "FAILED" }).eq("id", (invoice as any).id);
      return json({ error: body?.displayMessage || body?.message || `Yoco checkout failed (${res.status})` }, 400);
    }

    await admin.from("subscription_invoices")
      .update({ yoco_charge_id: body?.id ?? null }).eq("id", (invoice as any).id);

    return json({ redirectUrl: body?.redirectUrl, checkoutId: body?.id, invoiceId: (invoice as any).id });
  } catch (e) {
    console.error("yoco-create-checkout error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
