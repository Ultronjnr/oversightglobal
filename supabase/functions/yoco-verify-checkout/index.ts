import { corsHeaders, json, adminClient, getAuthContext } from "../_shared/payments.ts";

function yocoSecret(): string | undefined {
  return Deno.env.get("YOCO_SECRET_KEY") ?? Deno.env.get("STRIPE_TEST_API_KEY") ?? undefined;
}

// Confirms a hosted-checkout result when the user returns from Yoco, so the
// subscription activates even if the webhook is delayed or not configured.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secretKey = yocoSecret();
    if (!secretKey) return json({ error: "Yoco secret key not configured" }, 503);

    const { userId, orgId } = await getAuthContext(req);
    if (!userId || !orgId) return json({ error: "Unauthorized" }, 401);

    const { invoiceId } = await req.json();
    if (!invoiceId) return json({ error: "Missing invoiceId" }, 400);

    const admin = adminClient();
    const { data: inv } = await admin
      .from("subscription_invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!inv || (inv as any).organization_id !== orgId) return json({ error: "Invoice not found" }, 404);
    if ((inv as any).status === "PAID") return json({ status: "PAID" });

    const checkoutId = (inv as any).yoco_charge_id;
    if (!checkoutId) return json({ status: (inv as any).status });

    const res = await fetch(`https://payments.yoco.com/api/checkouts/${checkoutId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: body?.message || `Yoco lookup failed (${res.status})` }, 400);

    const state = String(body?.status ?? "").toLowerCase();
    if (state === "completed" || state === "succeeded") {
      await admin.from("subscription_invoices")
        .update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", invoiceId);
      await admin.from("organization_subscriptions").update({
        status: "ACTIVE",
        current_period_start: (inv as any).period_start,
        current_period_end: (inv as any).period_end,
        next_billing_date: (inv as any).period_end,
      }).eq("organization_id", orgId);
      return json({ status: "PAID" });
    }
    return json({ status: state || (inv as any).status });
  } catch (e) {
    console.error("yoco-verify-checkout error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
