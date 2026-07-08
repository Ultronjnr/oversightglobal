import { corsHeaders, json, adminClient, getAuthContext, auditPayment } from "../_shared/payments.ts";

// Retries a failed Netcash payment by re-submitting its batch.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, orgId } = await getAuthContext(req);
    if (!userId || !orgId) return json({ error: "Unauthorized" }, 401);
    const { paymentId } = await req.json();
    if (!paymentId) return json({ error: "Missing paymentId" }, 400);

    const admin = adminClient();
    const { data: payment } = await admin.from("netcash_payments").select("*").eq("id", paymentId).eq("organization_id", orgId).maybeSingle();
    if (!payment) return json({ error: "Payment not found" }, 404);

    await admin.from("netcash_payments").update({
      status: "RETRYING", retry_count: ((payment as any).retry_count ?? 0) + 1, last_error: null,
    }).eq("id", paymentId);

    await auditPayment(admin, {
      organization_id: orgId, batch_id: (payment as any).batch_id, action: "NETCASH_RETRY",
      performed_by: userId, amount: (payment as any).amount,
      notes: `Retry attempt ${((payment as any).retry_count ?? 0) + 1}`,
    });

    // Re-submit the whole batch (Netcash processes at batch level)
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/netcash-submit-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "" },
      body: JSON.stringify({ batchId: (payment as any).batch_id }),
    });
    const result = await resp.json().catch(() => ({}));
    return json({ success: true, resubmit: result });
  } catch (e) {
    console.error("netcash-retry error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
