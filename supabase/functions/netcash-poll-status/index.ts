import { corsHeaders, json, adminClient, getAuthContext, auditPayment } from "../_shared/payments.ts";

const NIWS_URL = "https://ws.netcash.co.za/NIWS/niws.asmx";

async function requestReport(serviceKey: string, reference: string) {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RequestMerchantStatement xmlns="https://ws.netcash.co.za/niws/">
      <ServiceKey>${serviceKey}</ServiceKey>
      <BatchReference>${reference}</BatchReference>
    </RequestMerchantStatement>
  </soap:Body>
</soap:Envelope>`;
  const res = await fetch(NIWS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "https://ws.netcash.co.za/niws/RequestMerchantStatement" },
    body: soap,
  });
  return { ok: res.ok, status: res.status, raw: await res.text() };
}

// Refreshes settlement status for a batch's Netcash payments.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Allow both authed (manual) and service-role (scheduled) calls
    const { orgId } = await getAuthContext(req);
    const body = await req.json().catch(() => ({}));
    const { batchId } = body;
    const admin = adminClient();
    const serviceKey = Deno.env.get("NETCASH_SERVICE_KEY");

    let q = admin.from("netcash_payments").select("*").in("status", ["SUBMITTED", "PROCESSING", "RETRYING"]);
    if (batchId) q = q.eq("batch_id", batchId);
    if (orgId) q = q.eq("organization_id", orgId);
    const { data: payments } = await q;
    const pays = payments ?? [];

    if (!serviceKey) return json({ success: false, error: "NETCASH_SERVICE_KEY not configured", pending: pays.length }, 200);
    if (pays.length === 0) return json({ success: true, updated: 0 });

    const refs = Array.from(new Set(pays.map((p: any) => p.netcash_reference).filter(Boolean)));
    let settledCount = 0;
    for (const ref of refs) {
      const report = await requestReport(serviceKey, ref);
      // Naive parse: look for settlement/paid indicators in the response
      const settled = /settled|paid|successful/i.test(report.raw);
      const failed = /rejected|failed|unpaid/i.test(report.raw);
      const newStatus = settled ? "SETTLED" : failed ? "FAILED" : "PROCESSING";
      const { data: updated } = await admin.from("netcash_payments").update({
        status: newStatus,
        settled_at: settled ? new Date().toISOString() : null,
        last_error: failed ? "Reported unpaid by Netcash" : null,
      }).eq("netcash_reference", ref).select();
      settledCount += (updated ?? []).length;

      // Roll up batch status
      const bId = (pays.find((p: any) => p.netcash_reference === ref) as any)?.batch_id;
      if (bId) {
        const { data: all } = await admin.from("netcash_payments").select("status").eq("batch_id", bId);
        const statuses = (all ?? []).map((x: any) => x.status);
        const rollup = statuses.every((s) => s === "SETTLED") ? "SETTLED"
          : statuses.some((s) => s === "FAILED") ? "FAILED" : "PROCESSING";
        await admin.from("payment_batches").update({ provider_status: rollup }).eq("id", bId);
        if (rollup === "SETTLED") {
          await admin.from("payment_batches").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", bId);
        }
        const { data: b } = await admin.from("payment_batches").select("organization_id, total_amount").eq("id", bId).maybeSingle();
        if (b) await auditPayment(admin, {
          organization_id: (b as any).organization_id, batch_id: bId,
          action: "NETCASH_STATUS_UPDATE", new_status: rollup, notes: `Batch settlement status: ${rollup}`,
        });
      }
    }

    return json({ success: true, updated: settledCount });
  } catch (e) {
    console.error("netcash-poll-status error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
