import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";
import { analyzeDocument, type OcrExtracted } from "@/services/ocr.service";
import { v4 as uuidv4 } from "uuid";

const INVOICE_BUCKET = "invoice-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface TrailQuote {
  id: string;
  quote_number: string | null;
  supplier_id: string | null;
  supplier_name: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  status: string;
  document_url: string | null;
  created_at: string;
}

export interface ProcurementTrail {
  pr: {
    id: string;
    title: string | null;
    status: string;
    total_amount: number;
    created_at: string;
  } | null;
  /** The quote (and therefore supplier) the organisation chose. */
  selected: TrailQuote | null;
  /** Every other quotation received for this purchase — kept for audit. */
  alternatives: TrailQuote[];
  invoice: {
    id: string;
    status: string;
    document_url: string | null;
    supplier_id: string | null;
    created_at: string;
  } | null;
  transaction: { id: string; status: string; payment_reference: string | null } | null;
  /** True once a quote is selected but the actual invoice has not arrived. */
  awaitingInvoice: boolean;
}

const toTrailQuote = (q: any): TrailQuote => ({
  id: q.id,
  quote_number: q.quote_number ?? null,
  supplier_id: q.supplier_id ?? null,
  supplier_name: q.supplier?.company_name || q.supplier_name || "Unnamed supplier",
  amount: Number(q.amount) || 0,
  vat_amount: Number(q.vat_amount) || 0,
  total_amount: Number(q.total_amount) || Number(q.amount) || 0,
  status: q.status,
  document_url: q.document_url ?? null,
  created_at: q.created_at,
});

/**
 * Full procurement history for one requisition:
 * Transaction -> Invoice -> PR -> Selected Quote -> Selected Supplier -> Other Quotes.
 */
export async function getProcurementTrail(
  prId: string
): Promise<{ success: boolean; data?: ProcurementTrail; error?: string }> {
  try {
    const [prRes, quotesRes, invoiceRes] = await Promise.all([
      supabase
        .from("purchase_requisitions")
        .select("id, title, status, total_amount, created_at, transaction_id")
        .eq("id", prId)
        .maybeSingle(),
      supabase
        .from("quotes")
        .select(
          "id, quote_number, supplier_id, supplier_name, amount, vat_amount, total_amount, status, document_url, created_at, supplier:suppliers!quotes_supplier_id_fkey(id, company_name)"
        )
        .eq("pr_id", prId)
        .order("created_at", { ascending: true }),
      supabase
        .from("invoices")
        .select("id, status, document_url, supplier_id, created_at, quote_id")
        .eq("pr_id", prId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (prRes.error) throw prRes.error;
    if (quotesRes.error) throw quotesRes.error;

    const quotes = (quotesRes.data ?? []).map(toTrailQuote);
    const selected =
      quotes.find((q) => q.status === "ACCEPTED" || q.status === "INVOICE_UPLOADED") ?? null;
    const invoice = (invoiceRes.data ?? [])[0] ?? null;
    const pr: any = prRes.data;

    let transaction: ProcurementTrail["transaction"] = null;
    if (pr?.transaction_id) {
      const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, payment_reference")
        .eq("id", pr.transaction_id)
        .maybeSingle();
      if (txn) {
        transaction = {
          id: (txn as any).id,
          status: (txn as any).status,
          payment_reference: (txn as any).payment_reference ?? null,
        };
      }
    }

    return {
      success: true,
      data: {
        pr: pr
          ? {
              id: pr.id,
              title: pr.title ?? null,
              status: pr.status,
              total_amount: Number(pr.total_amount) || 0,
              created_at: pr.created_at,
            }
          : null,
        selected,
        alternatives: quotes.filter((q) => q.id !== selected?.id),
        invoice: invoice
          ? {
              id: (invoice as any).id,
              status: (invoice as any).status,
              document_url: (invoice as any).document_url ?? null,
              supplier_id: (invoice as any).supplier_id ?? null,
              created_at: (invoice as any).created_at,
            }
          : null,
        transaction,
        awaitingInvoice: Boolean(selected) && !invoice,
      },
    };
  } catch (error) {
    logError("getProcurementTrail", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

export interface RecordInvoiceResult {
  success: boolean;
  error?: string;
  /** Supplier named on the scanned invoice differs from the selected supplier. */
  supplierMismatch?: boolean;
  selectedSupplier?: string;
  scannedSupplier?: string;
  extracted?: OcrExtracted;
}

/**
 * One-person flow: the authorised user uploads the actual invoice received from
 * the supplier they selected. The invoice is scanned, then matched to
 * Invoice -> Selected Supplier -> Selected Quote -> PR. A supplier that does not
 * match is reported as a discrepancy — never silently swapped.
 */
export async function recordInvoiceForSelectedQuote(
  file: File,
  prId: string,
  quoteId: string
): Promise<RecordInvoiceResult> {
  try {
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "File must be smaller than 10MB" };
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${user.id}/internal/${prId}/${uuidv4()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(INVOICE_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      logError("recordInvoiceForSelectedQuote:upload", uploadError);
      return { success: false, error: getSafeErrorMessage(uploadError) };
    }

    // Scan first so we can compare the supplier on the document.
    let extracted: OcrExtracted | undefined;
    try {
      const scan = await analyzeDocument({
        document_type: "INVOICE",
        bucket: INVOICE_BUCKET as any,
        storage_path: path,
        pr_id: prId,
      });
      extracted = scan.analysis?.extracted ?? undefined;
    } catch {
      // A failed scan must not block recording the invoice.
    }

    const { data, error } = await supabase.rpc("record_internal_invoice" as any, {
      _pr_id: prId,
      _quote_id: quoteId,
      _document_url: path,
      _invoice_supplier_name: extracted?.supplier_name ?? null,
    });

    if (error) {
      await supabase.storage.from(INVOICE_BUCKET).remove([path]);
      logError("recordInvoiceForSelectedQuote:rpc", error);
      return { success: false, error: getSafeErrorMessage(error) };
    }

    const result = data as any;
    if (!result?.success) {
      await supabase.storage.from(INVOICE_BUCKET).remove([path]);
      return { success: false, error: result?.error || "Could not record the invoice" };
    }

    return {
      success: true,
      supplierMismatch: Boolean(result.supplier_mismatch),
      selectedSupplier: result.supplier_name ?? undefined,
      scannedSupplier: extracted?.supplier_name ?? undefined,
      extracted,
    };
  } catch (error) {
    logError("recordInvoiceForSelectedQuote", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}
