import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";
import type { OcrExtracted } from "@/services/ocr.service";
import { uploadAttachment } from "@/services/attachment.service";

export type SarsValidationCode =
  | "VALID"
  | "MISSING_VAT_NUMBER"
  | "MISSING_SUPPLIER_DETAILS"
  | "MISSING_INVOICE_NUMBER"
  | "MISSING_INVOICE_DATE"
  | "MISSING_VAT_AMOUNT";

export interface SarsValidationResult {
  isValid: boolean;
  codes: SarsValidationCode[];
  checks: {
    supplier_name: boolean;
    supplier_vat_number: boolean;
    document_number: boolean;
    document_date: boolean;
    vat_amount: boolean;
  };
}

/**
 * Validate that extracted invoice data forms a valid SARS tax invoice.
 * SARS requires: supplier legal name, supplier VAT #, invoice serial #,
 * invoice date and VAT amount (for standard-rated supplies).
 */
export function validateSarsInvoice(
  e: Partial<OcrExtracted> | null | undefined,
): SarsValidationResult {
  const checks = {
    supplier_name: !!e?.supplier_name?.trim(),
    supplier_vat_number: !!e?.supplier_vat_number?.toString().trim(),
    document_number: !!e?.document_number?.toString().trim(),
    document_date: !!e?.document_date?.toString().trim(),
    vat_amount:
      typeof e?.vat_amount === "number" && (e?.vat_amount ?? 0) >= 0,
  };
  const codes: SarsValidationCode[] = [];
  if (!checks.supplier_name) codes.push("MISSING_SUPPLIER_DETAILS");
  if (!checks.supplier_vat_number) codes.push("MISSING_VAT_NUMBER");
  if (!checks.document_number) codes.push("MISSING_INVOICE_NUMBER");
  if (!checks.document_date) codes.push("MISSING_INVOICE_DATE");
  if (!checks.vat_amount) codes.push("MISSING_VAT_AMOUNT");
  const isValid = codes.length === 0;
  return { isValid, codes: isValid ? ["VALID"] : codes, checks };
}

function genTransactionId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${ymd}-${rand}`;
}

export interface CreateTxnFromInvoiceInput {
  file?: File | null;
  // Extracted / corrected fields
  supplier_name: string;
  supplier_id?: string | null;
  supplier_vat_number?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_branch_code?: string | null;
  bank_account_type?: string | null;
  document_number?: string | null;
  document_date?: string | null;
  subtotal?: number | null;
  vat_amount?: number | null;
  total_amount: number;
  currency?: string;
  category_id: string;
  notes?: string | null;
  /** Editable, AI-extracted line items */
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total?: number;
  }>;
  /** Raw OCR analysis id for traceability */
  ocr_analysis_id?: string | null;
}

export interface CreateTxnFromInvoiceResult {
  success: boolean;
  error?: string;
  pr_id?: string;
  transaction_id?: string;
}

/**
 * Insert a PR pre-approved by Finance (status = FINANCE_APPROVED). The
 * existing DB trigger creates a transaction row automatically. We then
 * link the supplier and (optionally) attach the source invoice file.
 */
export async function createTransactionFromInvoice(
  input: CreateTxnFromInvoiceInput,
): Promise<CreateTxnFromInvoiceResult> {
  try {
    const total = Number(input.total_amount);
    if (!Number.isFinite(total) || total <= 0) {
      return { success: false, error: "Total amount must be greater than zero" };
    }
    if (!input.supplier_name?.trim()) {
      return { success: false, error: "Supplier name is required" };
    }
    if (!input.category_id) {
      return { success: false, error: "Category is required" };
    }

    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return { success: false, error: "Not authenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, name, surname, department")
      .eq("id", user.id)
      .single();
    if (!profile?.organization_id) {
      return { success: false, error: "Organization not found" };
    }

    const userName = `${(profile as any).name ?? ""}${(profile as any).surname ? " " + (profile as any).surname : ""}`.trim() || (user.email ?? "Finance");
    const txnRef = genTransactionId();
    const desc = input.document_number
      ? `Invoice ${input.document_number} – ${input.supplier_name}`
      : `Invoice from ${input.supplier_name}`;

    const cleanLineItems = (input.line_items ?? [])
      .filter((li) => li && (li.description?.trim() || (li.total ?? 0) > 0));

    const items =
      cleanLineItems.length > 0
        ? cleanLineItems.map((li) => {
            const qty = Number(li.quantity) > 0 ? Number(li.quantity) : 1;
            const lineTotal = Number(li.total) || 0;
            const unit =
              Number(li.unit_price) > 0
                ? Number(li.unit_price)
                : Number((lineTotal / qty).toFixed(2));
            return {
              description: li.description?.trim() || desc,
              quantity: qty,
              unit_price: unit,
              price: lineTotal || Number((unit * qty).toFixed(2)),
              supplier_preference: input.supplier_name.trim(),
            };
          })
        : [
            {
              description: desc,
              quantity: 1,
              unit_price: total,
              price: total,
              supplier_preference: input.supplier_name.trim(),
            },
          ];

    const history = [
      {
        action: "Created from scanned invoice",
        user_id: user.id,
        user_name: userName,
        timestamp: new Date().toISOString(),
        details:
          `Auto-created from OCR scan. Invoice #: ${input.document_number ?? "—"}. ` +
          `Date: ${input.document_date ?? "—"}. VAT #: ${input.supplier_vat_number ?? "—"}.`,
      },
      {
        action: "Finance Approved",
        user_id: user.id,
        user_name: userName,
        timestamp: new Date().toISOString(),
        details: "Approved on capture by Finance via Scan Invoice workflow.",
      },
    ];

    const { data: prRow, error: prErr } = await supabase
      .from("purchase_requisitions")
      .insert({
        transaction_id: txnRef,
        organization_id: profile.organization_id,
        requested_by: user.id,
        requested_by_name: userName,
        requested_by_department: (profile as any).department ?? null,
        items: items as any,
        total_amount: total,
        currency: input.currency || "ZAR",
        urgency: "NORMAL",
        hod_status: "Approved",
        finance_status: "Approved",
        status: "FINANCE_APPROVED",
        category_id: input.category_id,
        history: history as any,
      } as any)
      .select("id")
      .single();

    if (prErr || !prRow) {
      logError("createTransactionFromInvoice:insertPR", prErr);
      return { success: false, error: getSafeErrorMessage(prErr) };
    }

    // Link supplier to the auto-created transaction
    const txnUpdate: Record<string, unknown> = {
      supplier_name: input.supplier_name.trim(),
    };
    if (input.supplier_id) txnUpdate.supplier_id = input.supplier_id;
    if (input.bank_name) txnUpdate.bank_name = input.bank_name.trim();
    if (input.bank_account_number) txnUpdate.bank_account_number = input.bank_account_number.trim();
    if (input.bank_branch_code) txnUpdate.bank_branch_code = input.bank_branch_code.trim();
    if (input.bank_account_type) txnUpdate.bank_account_type = input.bank_account_type.trim();
    const { data: txnRow } = await supabase
      .from("transactions" as any)
      .update(txnUpdate)
      .eq("pr_id", prRow.id)
      .select("id")
      .single();

    // If a real supplier is linked, persist banking details in the
    // Finance/Admin-restricted supplier_bank_details table.
    if (input.supplier_id && (input.bank_name || input.bank_account_number || input.bank_branch_code || input.bank_account_type)) {
      const bankUpdate: Record<string, unknown> = {
        supplier_id: input.supplier_id,
        organization_id: profile.organization_id,
      };
      if (input.bank_name) bankUpdate.bank_name = input.bank_name.trim();
      if (input.bank_account_number) bankUpdate.bank_account_number = input.bank_account_number.trim();
      if (input.bank_branch_code) bankUpdate.bank_branch_code = input.bank_branch_code.trim();
      if (input.bank_account_type) bankUpdate.bank_account_type = input.bank_account_type.trim();
      await supabase
        .from("supplier_bank_details" as any)
        .upsert(bankUpdate, { onConflict: "supplier_id" });
    }

    const transactionId = (txnRow as any)?.id as string | undefined;

    // Attach the original invoice file (best effort)
    if (input.file && transactionId) {
      const upRes = await uploadAttachment({
        file: input.file,
        kind: "INVOICE",
        pr_id: prRow.id,
        transaction_id: transactionId,
        supplier_id: input.supplier_id ?? null,
        supplier_name: input.supplier_name.trim(),
        invoice_number: input.document_number ?? null,
        invoice_date: input.document_date ?? null,
        vat_number: input.supplier_vat_number ?? null,
        notes: input.notes ?? null,
      });
      if (!upRes.success) {
        console.warn("[scan-invoice] attachment upload failed:", upRes.error);
      }
    }

    return { success: true, pr_id: prRow.id, transaction_id: transactionId };
  } catch (e: any) {
    logError("createTransactionFromInvoice", e);
    return { success: false, error: getSafeErrorMessage(e) };
  }
}