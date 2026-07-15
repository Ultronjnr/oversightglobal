import { corsHeaders, json, adminClient, recordEvent, auditPayment } from "../_shared/payments.ts";

// Processes Netcash payment status callbacks. Netcash posts form-encoded notifications.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();
    let payload: Record<string, string> = {};
    try {
      payload = Object.fromEntries(new URLSearchParams(raw));
    } catch { payload = JSON.parse(raw || "{}"); }

    const admin = adminClient();
    const expected = Deno.env.get("NETCASH_WEBHOOK_SECRET");
    const provided = payload["Extra1"] || payload["secret"] || req.headers.get("x-netcash-secret") || "";
    // Fail closed: if the shared secret is not configured we cannot
    // authenticate the webhook, so reject the request outright instead of
    // accepting it as trusted.
    if (!expected) {
      console.error("netcash-webhook: NETCASH_WEBHOOK_SECRET not configured; rejecting");
      return json({ error: "Webhook secret not configured" }, 503);
    }
    const verified = provided === expected;
    if (!verified) return json({ error: "Invalid secret" }, 401);

    const reference = payload["Reference"] || payload["BatchReference"] || payload["PaymentReference"] || "";
    const externalId = payload["RequestTrace"] || reference || crypto.randomUUID();

    const fresh = await recordEvent(admin, "NETCASH", externalId, payload["TransactionAccepted"] ?? "status", verified, payload);
    if (!fresh) return json({ success: true, duplicate: true });

    if (reference) {
      const accepted = (payload["TransactionAccepted"] ?? "").toLowerCase() === "true" || /settled|paid/i.test(JSON.stringify(payload));
      const newStatus = accepted ? "SETTLED" : "FAILED";
      const { data: updated } = await admin.from("netcash_payments").update({
        status: newStatus, settled_at: accepted ? new Date().toISOString() : null,
        last_error: accepted ? null : (payload["Reason"] ?? "Rejected by Netcash"),
      }).eq("netcash_reference", reference).select();

      const bId = (updated?.[0] as any)?.batch_id;
      const org = (updated?.[0] as any)?.organization_id;
      if (bId) {
        const { data: all } = await admin.from("netcash_payments").select("status").eq("batch_id", bId);
        const statuses = (all ?? []).map((x: any) => x.status);
        const rollup = statuses.every((s) => s === "SETTLED") ? "SETTLED"
          : statuses.some((s) => s === "FAILED") ? "FAILED" : "PROCESSING";
        await admin.from("payment_batches").update({ provider_status: rollup }).eq("id", bId);
        if (rollup === "SETTLED") await admin.from("payment_batches").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", bId);
        if (org) await auditPayment(admin, {
          organization_id: org, batch_id: bId, action: "NETCASH_WEBHOOK", new_status: rollup,
          notes: `Webhook settlement: ${rollup}`,
        });
      }
    }

    return json({ success: true });
  } catch (e) {
    console.error("netcash-webhook error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
