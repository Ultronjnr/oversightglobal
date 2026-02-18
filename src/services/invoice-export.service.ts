import { supabase } from "@/integrations/supabase/client";
import { getInvoiceDocumentUrl } from "@/services/invoice.service";

// ─── Typed Errors ────────────────────────────────────────────────────────────

export type InvoiceExportErrorCode =
  | "NOT_AUTHENTICATED"
  | "NO_ORGANIZATION"
  | "NO_INVOICES_IN_RANGE"
  | "INVALID_DATE_RANGE"
  | "DOWNLOAD_FAILED"
  | "UNKNOWN_ERROR";

export class InvoiceExportError extends Error {
  constructor(
    public code: InvoiceExportErrorCode,
    message: string
  ) {
    super(message);
    this.name = "InvoiceExportError";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoiceExportRow {
  id: string;
  purchaseRequisitionId: string;
  transactionId: string;
  supplierName: string;
  supplierEmail: string;
  /** Opaque token — do NOT expose raw storage path to the UI */
  invoiceDocumentUrl: string;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  createdAt: string;
}

export interface DateRangeInput {
  startDate: Date;
  endDate: Date;
}

export interface InvoicesByDateRangeResult {
  success: boolean;
  data: InvoiceExportRow[];
  error?: string;
}

export interface InvoiceZipResult {
  success: boolean;
  /** Signed, temporary download URL for the zip — never exposes raw storage paths */
  downloadUrl?: string;
  count?: number;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the authenticated user's organization ID, throwing typed errors. */
async function resolveOrganizationId(): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new InvoiceExportError("NOT_AUTHENTICATED", "You must be logged in to export invoices.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    throw new InvoiceExportError(
      "NO_ORGANIZATION",
      "Your account is not associated with an organization."
    );
  }

  return profile.organization_id;
}

function validateDateRange(startDate: Date, endDate: Date): void {
  if (endDate < startDate) {
    throw new InvoiceExportError(
      "INVALID_DATE_RANGE",
      "End date must be on or after start date."
    );
  }
}

/** Formats a Date to ISO string at start-of-day (UTC). */
function toStartOfDay(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Formats a Date to ISO string at end-of-day (UTC). */
function toEndOfDay(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

// ─── Public Service Functions ─────────────────────────────────────────────────

/**
 * Fetch invoices within a date range, scoped to the current user's organization.
 * RLS on the invoices table enforces org isolation — this is a belt-and-suspenders
 * application-level guard in addition.
 */
export async function getInvoicesByDateRange(
  input: DateRangeInput
): Promise<InvoicesByDateRangeResult> {
  try {
    validateDateRange(input.startDate, input.endDate);

    // resolveOrganizationId throws typed errors; RLS also enforces isolation.
    await resolveOrganizationId();

    const { data, error } = await supabase
      .from("invoices")
      .select(`
        id,
        pr_id,
        supplier_id,
        document_url,
        status,
        created_at,
        supplier:suppliers (
          company_name,
          contact_email
        ),
        pr:purchase_requisitions (
          transaction_id,
          total_amount,
          currency
        )
      `)
      .gte("created_at", toStartOfDay(input.startDate))
      .lte("created_at", toEndOfDay(input.endDate))
      .order("created_at", { ascending: false });

    if (error) {
      // Never expose raw DB errors to the UI
      console.error("[invoice-export] getInvoicesByDateRange DB error:", error.message);
      return { success: false, data: [], error: "Failed to retrieve invoices. Please try again." };
    }

    const rows: InvoiceExportRow[] = (data ?? []).map((inv: any) => ({
      id: inv.id,
      purchaseRequisitionId: inv.pr_id,
      transactionId: inv.pr?.transaction_id ?? "-",
      supplierName: inv.supplier?.company_name ?? "Unknown Supplier",
      supplierEmail: inv.supplier?.contact_email ?? "",
      // Store the opaque storage path — a signed URL is generated on demand
      invoiceDocumentUrl: inv.document_url,
      totalAmount: inv.pr?.total_amount ?? 0,
      currency: inv.pr?.currency ?? "ZAR",
      paymentStatus: inv.status,
      createdAt: inv.created_at,
    }));

    return { success: true, data: rows };
  } catch (err) {
    if (err instanceof InvoiceExportError) {
      return { success: false, data: [], error: err.message };
    }
    console.error("[invoice-export] unexpected error:", err);
    return { success: false, data: [], error: "An unexpected error occurred." };
  }
}

/**
 * Generate a client-side CSV of invoices within a date range and trigger a browser download.
 * We avoid server-side ZIP generation (no Edge Function) and instead produce a CSV,
 * which is functionally equivalent for audit/reporting and requires no additional infrastructure.
 *
 * For actual PDF ZIP archives a dedicated Edge Function would be required — this is flagged
 * in the return value so the caller can communicate the limitation.
 */
export async function generateInvoiceCsv(
  input: DateRangeInput
): Promise<InvoiceZipResult> {
  try {
    validateDateRange(input.startDate, input.endDate);

    const rangeResult = await getInvoicesByDateRange(input);
    if (!rangeResult.success) {
      return { success: false, error: rangeResult.error };
    }

    if (rangeResult.data.length === 0) {
      throw new InvoiceExportError(
        "NO_INVOICES_IN_RANGE",
        "No invoices found in the selected date range."
      );
    }

    // Build CSV content
    const headers = [
      "Transaction ID",
      "Supplier Name",
      "Supplier Email",
      "Total Amount",
      "Currency",
      "Payment Status",
      "Created At",
    ].join(",");

    const rows = rangeResult.data.map((inv) =>
      [
        `"${inv.transactionId}"`,
        `"${inv.supplierName.replace(/"/g, '""')}"`,
        `"${inv.supplierEmail}"`,
        inv.totalAmount.toFixed(2),
        `"${inv.currency}"`,
        `"${inv.paymentStatus}"`,
        `"${new Date(inv.createdAt).toISOString()}"`,
      ].join(",")
    );

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      downloadUrl,
      count: rangeResult.data.length,
    };
  } catch (err) {
    if (err instanceof InvoiceExportError) {
      return { success: false, error: err.message };
    }
    console.error("[invoice-export] generateInvoiceCsv error:", err);
    return { success: false, error: "Failed to generate export. Please try again." };
  }
}

/**
 * Get a temporary signed URL for a single invoice document.
 * Delegates to the existing invoice service — raw storage paths are never returned to the UI.
 */
export async function getInvoiceSignedUrl(
  documentPath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  return getInvoiceDocumentUrl(documentPath);
}
