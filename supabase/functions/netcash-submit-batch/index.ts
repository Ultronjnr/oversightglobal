import { corsHeaders, json, adminClient, getAuthContext, auditPayment } from "../_shared/payments.ts";

const NIWS_URL = "https://ws.netcash.co.za/NIWS/niws.asmx";

// Builds the Netcash creditor batch file (pipe-delimited) and submits via NIWS SOAP.
function buildBatchFile(serviceKey: string, rows: Array<{ account: string; branch: string; name: string; amount: number; reference: string }>) {
  const header = ["H", serviceKey, "1", new Date().toISOString().slice(0, 10).replace(/-/g, ""), "Supplier Payments"].join("|");
  const keyLine = ["K", "1", "2", "3", "4", "5", "6"].join("|");
  const detail = rows.map((r, i) =>
    ["T", String(i + 1), r.account, r.branch, r.name, r.amount.toFixed(2), r.reference].join("|"),
  );
  const footer = ["F", String(rows.length), rows.reduce((s, r) => s + r.amount, 0).toFixed(2)].join("|");
  return [header, keyLine, ...detail, footer].join("\n");
}

async function submitToNetcash(serviceKey: string, fileContents: string) {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <BatchFileUpload xmlns="https://ws.netcash.co.za/niws/">
      <ServiceKey>${serviceKey}</ServiceKey>
      <File>${fileContents.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</File>
    </BatchFileUpload>
  </soap:Body>
</soap:Envelope>`;
  const res = await fetch(NIWS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "https://ws.netcash.co.za/niws/BatchFileUpload" },
    body: soap,
  });
  const text = await res.text();
  const match = text.match(/<BatchFileUploadResult>(.*?)<\/BatchFileUploadResult>/s);
  return { ok: res.ok, status: res.status, reference: match?.[1]?.trim() ?? null, raw: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, orgId } = await getAuthContext(req);
    if (!userId || !orgId) return json({ error: "Unauthorized" }, 401);
    const { batchId } = await req.json();
    if (!batchId) return json({ error: "Missing batchId" }, 400);

    const admin = adminClient();

    // Authorize: finance or admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) => r.role === "FINANCE" || r.role === "ADMIN");
    if (!allowed) return json({ error: "Not permitted" }, 403);

    // Load batch + allocations with supplier + bank details
    const { data: batch } = await admin.from("payment_batches").select("*").eq("id", batchId).eq("organization_id", orgId).maybeSingle();
    if (!batch) return json({ error: "Batch not found" }, 404);
    if ((batch as any).status === "PAID") return json({ error: "Batch already paid" }, 409);

    const { data: allocations } = await admin
      .from("payment_allocations")
      .select(`id, amount_paid,
        invoice:invoices ( supplier:suppliers ( id, company_name ) ),
        transaction:transactions ( supplier_name, supplier:suppliers ( id, company_name ) )`)
      .eq("batch_id", batchId);

    const allocs = allocations ?? [];
    if (allocs.length === 0) return json({ error: "No allocations in batch" }, 400);

    // Collect supplier bank details
    const supplierIds = Array.from(new Set(allocs.map((a: any) =>
      a.invoice?.supplier?.id || a.transaction?.supplier?.id).filter(Boolean)));
    const { data: banks } = await admin
      .from("supplier_bank_details")
      .select("supplier_id, bank_account_number, bank_branch_code")
      .in("supplier_id", supplierIds.length ? supplierIds : ["00000000-0000-0000-0000-000000000000"]);
    const bankMap: Record<string, any> = {};
    (banks ?? []).forEach((b: any) => { bankMap[b.supplier_id] = b; });

    const serviceKey = Deno.env.get("NETCASH_SERVICE_KEY");

    // Create netcash_payments rows (idempotent-ish: clear prior for batch)
    await admin.from("netcash_payments").delete().eq("batch_id", batchId);

    const rowsForFile: any[] = [];
    const paymentRows: any[] = [];
    for (const a of allocs as any[]) {
      const supplierId = a.invoice?.supplier?.id || a.transaction?.supplier?.id;
      const name = a.invoice?.supplier?.company_name || a.transaction?.supplier?.company_name || a.transaction?.supplier_name || "Supplier";
      const bank = supplierId ? bankMap[supplierId] : null;
      paymentRows.push({
        organization_id: orgId, batch_id: batchId, allocation_id: a.id,
        amount: Number(a.amount_paid), currency: (batch as any).currency || "ZAR",
        status: bank?.bank_account_number ? "PENDING" : "FAILED",
        last_error: bank?.bank_account_number ? null : "Missing supplier bank details",
        created_by: userId,
      });
      if (bank?.bank_account_number) {
        rowsForFile.push({
          account: bank.bank_account_number, branch: bank.bank_branch_code || "",
          name, amount: Number(a.amount_paid), reference: (batch as any).batch_number || batchId.slice(0, 8),
        });
      }
    }
    const { data: inserted } = await admin.from("netcash_payments").insert(paymentRows).select();

    await auditPayment(admin, {
      organization_id: orgId, batch_id: batchId, action: "NETCASH_SUBMIT_INITIATED",
      old_status: (batch as any).status, amount: (batch as any).total_amount, performed_by: userId,
      notes: `Submitting ${rowsForFile.length} payment(s) to Netcash`,
    });

    if (!serviceKey) {
      await admin.from("payment_batches").update({ provider: "NETCASH", provider_status: "PENDING" }).eq("id", batchId);
      return json({ success: false, error: "NETCASH_SERVICE_KEY not configured — payments recorded as pending", pending: rowsForFile.length }, 200);
    }
    if (rowsForFile.length === 0) {
      await admin.from("payment_batches").update({ provider: "NETCASH", provider_status: "FAILED" }).eq("id", batchId);
      return json({ success: false, error: "No payable rows (missing bank details)" }, 200);
    }

    const file = buildBatchFile(serviceKey, rowsForFile);
    const result = await submitToNetcash(serviceKey, file);

    if (result.ok && result.reference && !/error/i.test(result.reference)) {
      await admin.from("netcash_payments").update({ status: "SUBMITTED", netcash_reference: result.reference })
        .eq("batch_id", batchId).eq("status", "PENDING");
      await admin.from("payment_batches").update({
        provider: "NETCASH", provider_status: "SUBMITTED", submitted_at: new Date().toISOString(),
      }).eq("id", batchId);
      await auditPayment(admin, {
        organization_id: orgId, batch_id: batchId, action: "NETCASH_SUBMITTED",
        new_status: "SUBMITTED", amount: (batch as any).total_amount, performed_by: userId,
        notes: `Netcash reference ${result.reference}`,
      });
      return json({ success: true, reference: result.reference, submitted: rowsForFile.length });
    }

    const err = result.reference || `HTTP ${result.status}`;
    await admin.from("netcash_payments").update({ status: "FAILED", last_error: err }).eq("batch_id", batchId).eq("status", "PENDING");
    await admin.from("payment_batches").update({ provider: "NETCASH", provider_status: "FAILED" }).eq("id", batchId);
    await auditPayment(admin, {
      organization_id: orgId, batch_id: batchId, action: "NETCASH_SUBMIT_FAILED",
      new_status: "FAILED", performed_by: userId, notes: err,
    });
    return json({ success: false, error: err }, 200);
  } catch (e) {
    console.error("netcash-submit-batch error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
