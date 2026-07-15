import { corsHeaders, json, adminClient } from "../_shared/payments.ts";

// Constant-time comparison of the presented bearer token against the
// project's service-role key. verify_jwt=true on this function makes the
// gateway reject unsigned/invalid JWTs before we get here; this final
// check ensures only callers holding the real service-role secret (i.e.
// pg_cron / internal invokers) may trigger the billing cycle.
function isServiceRoleToken(token: string): boolean {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !secret || token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

// Scheduled monthly: charges due subscriptions and processes retries.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authorization: only a trusted service-role caller (pg_cron / internal)
    // may trigger the billing cycle. Any other JWT is rejected.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!isServiceRoleToken(token)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = adminClient();
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // 1. Active subscriptions due for billing
    const { data: due } = await admin
      .from("organization_subscriptions")
      .select("organization_id, next_billing_date, status, cancel_at_period_end")
      .in("status", ["ACTIVE", "PAST_DUE"])
      .lte("next_billing_date", today);

    // 2. Failed invoices scheduled for retry
    const { data: retries } = await admin
      .from("subscription_payment_attempts")
      .select("organization_id, invoice_id, next_retry_at, status")
      .eq("status", "FAILED")
      .not("next_retry_at", "is", null)
      .lte("next_retry_at", nowIso);

    const chargeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/yoco-charge-subscription`;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const invoke = (payload: unknown) =>
      fetch(chargeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
        body: JSON.stringify(payload),
      }).catch((e) => console.error("charge invoke failed", e));

    let processed = 0;
    for (const s of (due ?? [])) {
      if ((s as any).cancel_at_period_end) {
        await admin.from("organization_subscriptions")
          .update({ status: "CANCELLED", cancelled_at: nowIso })
          .eq("organization_id", (s as any).organization_id);
        continue;
      }
      await invoke({ organizationId: (s as any).organization_id });
      processed++;
    }
    const retried = new Set<string>();
    for (const r of (retries ?? [])) {
      const key = (r as any).invoice_id;
      if (retried.has(key)) continue;
      retried.add(key);
      await invoke({ organizationId: (r as any).organization_id, invoiceId: key });
    }

    return json({ success: true, charged: processed, retried: retried.size });
  } catch (e) {
    console.error("billing-cron error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
