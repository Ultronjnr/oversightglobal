import { corsHeaders, json, adminClient, getAuthContext } from "../_shared/payments.ts";

// Saves a Yoco card token as the org's payment method (card vault) and, when a
// plan is selected, activates the subscription and triggers the first charge.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, orgId } = await getAuthContext(req);
    if (!userId || !orgId) return json({ error: "Unauthorized" }, 401);

    const { token, brand, last4, expiryMonth, expiryYear, cycle, planId } = await req.json();
    if (!token) return json({ error: "Missing card token" }, 400);

    const admin = adminClient();

    // Only admins may manage billing
    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "ADMIN").maybeSingle();
    if (!role) return json({ error: "Only administrators can manage billing" }, 403);

    // Replace existing default card(s)
    await admin.from("payment_methods").update({ is_default: false }).eq("organization_id", orgId);

    const { data: pm, error: pmErr } = await admin.from("payment_methods").insert({
      organization_id: orgId,
      provider: "YOCO",
      provider_token: token,
      brand: brand ?? null,
      last4: last4 ?? null,
      expiry_month: expiryMonth ?? null,
      expiry_year: expiryYear ?? null,
      is_default: true,
      created_by: userId,
    }).select().single();
    if (pmErr) throw pmErr;

    // Attach/refresh subscription plan if provided
    if (planId) {
      const { data: existing } = await admin
        .from("organization_subscriptions").select("id").eq("organization_id", orgId).maybeSingle();
      if (existing) {
        await admin.from("organization_subscriptions")
          .update({ plan_id: planId, billing_cycle: cycle ?? "MONTHLY", cancel_at_period_end: false })
          .eq("id", (existing as any).id);
      } else {
        await admin.from("organization_subscriptions").insert({
          organization_id: orgId, plan_id: planId, billing_cycle: cycle ?? "MONTHLY", status: "INCOMPLETE",
        });
      }

      // Trigger the first charge via the charge function (best-effort)
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/yoco-charge-subscription`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ organizationId: orgId }),
        });
      } catch (e) {
        console.error("initial charge trigger failed", e);
      }
    }

    return json({ success: true, paymentMethod: { id: (pm as any).id, brand, last4 } });
  } catch (e) {
    console.error("yoco-save-card error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
