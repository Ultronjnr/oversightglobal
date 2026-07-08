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
  /** Raw OCR-extracted JSON as returned by the model. */
  ocr_extracted?: Record<string, unknown> | null;
  /** Overall OCR confidence 0..1. */
  ocr_confidence?: number | null;
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
    // Persist detected VAT figures on the single source-of-truth transaction.
    {
      const inclusive = total;
      const vat = typeof input.vat_amount === "number" ? input.vat_amount : null;
      const exclusive =
        typeof input.subtotal === "number"
          ? input.subtotal
          : vat != null
          ? Number((inclusive - vat).toFixed(2))
          : Number((inclusive / 1.15).toFixed(2));
      const computedVat = vat != null ? vat : Number((inclusive - exclusive).toFixed(2));
      const rate = exclusive > 0 ? Number(((computedVat / exclusive) * 100).toFixed(2)) : 15;
      txnUpdate.inclusive_amount = inclusive;
      txnUpdate.exclusive_amount = exclusive;
      txnUpdate.vat_amount = computedVat;
      txnUpdate.vat_rate = rate;
      if (input.supplier_vat_number) txnUpdate.vat_number = input.supplier_vat_number.trim();
    }
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
      // Persist OCR JSON, the human-corrected fields and a version-history
      // envelope alongside the original file, permanently linked to the txn.
      const correctedData = {
        supplier_name: input.supplier_name.trim(),
        supplier_vat_number: input.supplier_vat_number ?? null,
        document_number: input.document_number ?? null,
        document_date: input.document_date ?? null,
        subtotal: input.subtotal ?? null,
        vat_amount: input.vat_amount ?? null,
        total_amount: total,
        currency: input.currency || "ZAR",
        line_items: cleanLineItems,
        bank_name: input.bank_name ?? null,
        bank_account_number: input.bank_account_number ?? null,
        bank_branch_code: input.bank_branch_code ?? null,
        bank_account_type: input.bank_account_type ?? null,
      };
      const aiExtracted = {
        ocr_analysis_id: input.ocr_analysis_id ?? null,
        ocr_confidence: input.ocr_confidence ?? null,
        ocr: input.ocr_extracted ?? null,
        corrected: correctedData,
        versions: [
          {
            version: 1,
            source: "SCAN_INVOICE",
            edited_by: user.id,
            edited_by_name: userName,
            edited_at: new Date().toISOString(),
            data: correctedData,
          },
        ],
      };
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
        ai_extracted: aiExtracted,
      });
      if (!upRes.success) {
        console.warn("[scan-invoice] attachment upload failed:", upRes.error);
      }
    }

    // Also persist the invoice on the PR's document_url so it surfaces on the
    // "Approved" (Payment Preparation) tab via the standard "View" button,
    // which resolves documents from the pr-documents bucket.
    if (input.file) {
      try {
        const safe = input.file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
        const docPath = `${user.id}/${prRow.id}-${Date.now()}-${safe}`;
        const { error: docUpErr } = await supabase.storage
          .from("pr-documents")
          .upload(docPath, input.file, {
            contentType: input.file.type,
          });
        if (!docUpErr) {
          await supabase
            .from("purchase_requisitions")
            .update({ document_url: docPath })
            .eq("id", prRow.id);
          // Single source of truth: also persist the scanned document directly
          // on the transaction record so the transaction viewer always resolves
          // the invoice/scan document from the transaction itself.
          await supabase
            .from("transactions" as any)
            .update({ document_url: docPath })
            .eq("pr_id", prRow.id);
        } else {
          console.warn("[scan-invoice] pr-documents upload failed:", docUpErr.message);
        }
      } catch (docErr) {
        console.warn("[scan-invoice] pr document persist failed:", docErr);
      }
    }

    return { success: true, pr_id: prRow.id, transaction_id: transactionId };
  } catch (e: any) {
    logError("createTransactionFromInvoice", e);
    return { success: false, error: getSafeErrorMessage(e) };
  }
}