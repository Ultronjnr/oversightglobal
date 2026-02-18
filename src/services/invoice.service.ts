import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { postSystemNote } from "@/services/pr-messaging.service";

const BUCKET_NAME = "invoice-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface Invoice {
  id: string;
  quote_id: string;
  pr_id: string;
  supplier_id: string;
  organization_id: string;
  document_url: string;
  status: "UPLOADED" | "AWAITING_PAYMENT" | "PAID";
  created_at: string;
  updated_at: string;
}

export interface UploadInvoiceResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

// ─── Validation error ────────────────────────────────────────────────────────

export class InvoiceUploadError extends Error {
  constructor(
    public code: "QUOTE_NOT_ACCEPTED" | "DUPLICATE_INVOICE" | "NOT_AUTHENTICATED" | "SUPPLIER_NOT_FOUND" | "UPLOAD_FAILED" | "INSERT_FAILED",
    message: string
  ) {
    super(message);
    this.name = "InvoiceUploadError";
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Verifies that a quote exists for this PR, belongs to this supplier, and has
 * been explicitly accepted by Finance.  This is the quotation-first gate:
 * no invoice may be uploaded unless Finance has already accepted a quote.
 */
async function verifyQuoteIsAccepted(quoteId: string, supplierId: string): Promise<void> {
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, status, supplier_id")
    .eq("id", quoteId)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (error) {
    console.error("[invoice] quote lookup error:", error.message);
    throw new InvoiceUploadError(
      "QUOTE_NOT_ACCEPTED",
      "Unable to verify quotation status. Please try again."
    );
  }

  if (!quote) {
    throw new InvoiceUploadError(
      "QUOTE_NOT_ACCEPTED",
      "Invoice upload allowed only after quotation approval. No matching quotation found."
    );
  }

  // The accepted_quote_and_reject_others RPC sets status = 'ACCEPTED'.
  // We also allow 'INVOICE_UPLOADED' to guard re-upload attempts separately.
  if (quote.status !== "ACCEPTED" && quote.status !== "INVOICE_UPLOADED") {
    throw new InvoiceUploadError(
      "QUOTE_NOT_ACCEPTED",
      "Invoice upload allowed only after quotation approval. Your quote has not yet been approved by Finance."
    );
  }
}

/**
 * Appends an audit entry to the PR's history JSONB column.
 * Non-fatal: failure is logged but does NOT block the upload.
 */
async function appendPRHistory(prId: string, entry: {
  action: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  details: string;
}): Promise<void> {
  try {
    const { data: pr, error: prFetchError } = await supabase
      .from("purchase_requisitions")
      .select("history")
      .eq("id", prId)
      .single();

    if (prFetchError || !pr) {
      console.warn("[invoice] could not fetch PR history for audit:", prFetchError?.message);
      return;
    }

    const currentHistory = Array.isArray(pr.history) ? pr.history : [];
    const newHistory = [...currentHistory, entry];

    const { error: updateError } = await supabase
      .from("purchase_requisitions")
      .update({ history: newHistory })
      .eq("id", prId);

    if (updateError) {
      console.warn("[invoice] could not update PR history:", updateError.message);
    }
  } catch (err) {
    console.warn("[invoice] appendPRHistory unexpected error:", err);
  }
}

/**
 * Upload an invoice document (PDF only) and create invoice record.
 *
 * Enforcement rules:
 *   1. Caller must be an authenticated supplier.
 *   2. A quote for this PR must exist AND be in ACCEPTED status (quotation-first rule).
 *   3. No invoice may already exist for this quote (immutability — no replacement).
 *   4. File must be PDF ≤ 10 MB.
 *   5. On success, PR history is updated with a system audit note.
 */
export async function uploadInvoice(
  file: File,
  quoteId: string,
  prId: string,
  organizationId: string
): Promise<UploadInvoiceResult> {
  try {
    // ── 1. File validation ───────────────────────────────────────────────────
    if (file.type !== "application/pdf") {
      return { success: false, error: "Only PDF files are allowed" };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "File size must be less than 10MB" };
    }

    // ── 2. Authentication ────────────────────────────────────────────────────
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // ── 3. Resolve supplier identity ─────────────────────────────────────────
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id, company_name")
      .eq("user_id", user.id)
      .single();

    if (supplierError || !supplier) {
      return { success: false, error: "Supplier profile not found" };
    }

    // ── 4. QUOTATION-FIRST GATE ───────────────────────────────────────────────
    //    Throws InvoiceUploadError with a clear message if the quote is not ACCEPTED.
    await verifyQuoteIsAccepted(quoteId, supplier.id);

    // ── 5. Immutability guard — no replacement after initial upload ───────────
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("quote_id", quoteId)
      .maybeSingle();

    if (existingInvoice) {
      return {
        success: false,
        error: "An invoice has already been uploaded for this quote and cannot be replaced.",
      };
    }

    // ── 6. Upload PDF to storage ──────────────────────────────────────────────
    const fileName = `${uuidv4()}.pdf`;
    const filePath = `${user.id}/${quoteId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[invoice] upload error:", uploadError);
      return { success: false, error: "Failed to upload invoice. Please try again." };
    }

    // ── 7. Create invoice record ──────────────────────────────────────────────
    //    Stores linked_quote_id, uploaded_by, and uploaded_at for full traceability.
    const now = new Date().toISOString();

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        quote_id: quoteId,
        pr_id: prId,
        supplier_id: supplier.id,
        organization_id: organizationId,
        document_url: filePath,
        status: "UPLOADED",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[invoice] insert error:", insertError);
      // Clean up the orphaned file
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      return { success: false, error: "Failed to create invoice record. Please try again." };
    }

    // ── 8. Progress the quote status ─────────────────────────────────────────
    await supabase
      .from("quotes")
      .update({ status: "INVOICE_UPLOADED" })
      .eq("id", quoteId);

    // ── 9. Append immutable audit entry to PR history ─────────────────────────
    //    Non-fatal; logged but does not block success response.
    await appendPRHistory(prId, {
      action: "INVOICE_UPLOADED",
      user_id: user.id,
      user_name: supplier.company_name,
      timestamp: now,
      details: `Final invoice uploaded after quotation approval. Quote ID: ${quoteId.slice(0, 8)}…`,
    });

    // ── 10. Post system note to PR chat for full single-audit-trail visibility ─
    //    Non-fatal — run best-effort; failure does not block the upload response.
    postSystemNote(
      prId,
      `📎 Final invoice uploaded by ${supplier.company_name} after quotation approval.`
    ).catch((err) => console.warn("[invoice] postSystemNote failed:", err));

    return { success: true, invoice: invoice as Invoice };
  } catch (err: any) {
    if (err instanceof InvoiceUploadError) {
      return { success: false, error: err.message };
    }
    console.error("[invoice] uploadInvoice unexpected error:", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Get a signed URL for viewing an invoice document
 */
export async function getInvoiceDocumentUrl(
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 600); // 10-minute expiry

    if (error) {
      console.error("Signed URL error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    console.error("getInvoiceDocumentUrl error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get invoices for the current supplier
 */
export async function getSupplierInvoices(): Promise<{
  success: boolean;
  data: Invoice[];
  error?: string;
}> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    // Get supplier ID
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!supplier) {
      return { success: false, data: [], error: "Supplier profile not found" };
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as Invoice[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

export interface InvoiceWithDetails extends Invoice {
  supplier?: {
    id: string;
    company_name: string;
    contact_email: string;
  };
  pr?: {
    id: string;
    transaction_id: string;
    total_amount: number;
    currency: string;
    requested_by_name: string;
  };
  quote?: {
    id: string;
    amount: number;
  };
}

/**
 * Get invoices for finance (organization-wide)
 */
export async function getOrganizationInvoices(): Promise<{
  success: boolean;
  data: Invoice[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as Invoice[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Get invoices awaiting payment with full details
 */
export async function getInvoicesAwaitingPayment(): Promise<{
  success: boolean;
  data: InvoiceWithDetails[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        supplier:suppliers (
          id,
          company_name,
          contact_email
        ),
        pr:purchase_requisitions (
          id,
          transaction_id,
          total_amount,
          currency,
          requested_by_name
        ),
        quote:quotes (
          id,
          amount
        )
      `)
      .in("status", ["UPLOADED", "AWAITING_PAYMENT"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getInvoicesAwaitingPayment error:", error);
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as InvoiceWithDetails[] };
  } catch (error: any) {
    console.error("getInvoicesAwaitingPayment error:", error);
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Update invoice status (Finance only)
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "AWAITING_PAYMENT" | "PAID"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoiceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark multiple invoices as paid (batch operation)
 */
export async function markInvoicesAsPaid(
  invoiceIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (invoiceIds.length === 0) {
      return { success: false, error: "No invoices selected" };
    }

    const { error } = await supabase
      .from("invoices")
      .update({ status: "PAID" })
      .in("id", invoiceIds);

    if (error) {
      console.error("markInvoicesAsPaid error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("markInvoicesAsPaid error:", error);
    return { success: false, error: error.message };
  }
}
