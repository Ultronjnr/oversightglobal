import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";
import { analyzeDocument, type OcrExtracted } from "@/services/ocr.service";
import { v4 as uuidv4 } from "uuid";

const QUOTE_BUCKET = "quote-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface SourcedQuote {
  id: string;
  pr_id: string;
  organization_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  amount: number;
  delivery_time: string | null;
  valid_until: string | null;
  notes: string | null;
  status: string;
  source: "PORTAL" | "MANUAL";
  document_url: string | null;
  created_at: string;
  /** Resolved display name (platform supplier name wins over the typed one). */
  display_supplier: string;
}

/** All quotes attached to a requisition — portal-submitted and manually captured. */
export async function getPRSourcingQuotes(
  prId: string
): Promise<{ success: boolean; data: SourcedQuote[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("quotes")
      .select("*, supplier:suppliers(id, company_name)")
      .eq("pr_id", prId)
      .order("amount", { ascending: true });

    if (error) {
      logError("getPRSourcingQuotes", error);
      return { success: false, data: [], error: getSafeErrorMessage(error) };
    }

    const rows: SourcedQuote[] = ((data as any[]) || []).map((q) => ({
      id: q.id,
      pr_id: q.pr_id,
      organization_id: q.organization_id,
      supplier_id: q.supplier_id,
      supplier_name: q.supplier_name,
      amount: Number(q.amount) || 0,
      delivery_time: q.delivery_time,
      valid_until: q.valid_until,
      notes: q.notes,
      status: q.status,
      source: (q.source as "PORTAL" | "MANUAL") || "PORTAL",
      document_url: q.document_url,
      created_at: q.created_at,
      display_supplier:
        q.supplier?.company_name || q.supplier_name || "Unnamed supplier",
    }));

    return { success: true, data: rows };
  } catch (error) {
    logError("getPRSourcingQuotes", error);
    return { success: false, data: [], error: getSafeErrorMessage(error) };
  }
}

/** Upload a manually captured quote document (PDF or image). */
export async function uploadManualQuoteDocument(
  file: File,
  prId: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "File must be smaller than 10MB" };
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${user.id}/manual/${prId}/${uuidv4()}.${ext}`;

    const { error } = await supabase.storage
      .from(QUOTE_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (error) {
      logError("uploadManualQuoteDocument", error);
      return { success: false, error: getSafeErrorMessage(error) };
    }
    return { success: true, path };
  } catch (error) {
    logError("uploadManualQuoteDocument", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/** Run OCR over an uploaded quote document so amounts can be prefilled. */
export async function scanQuoteDocument(
  storagePath: string,
  prId: string
): Promise<{ success: boolean; extracted?: OcrExtracted; error?: string }> {
  const result = await analyzeDocument({
    document_type: "PR_DOCUMENT",
    bucket: QUOTE_BUCKET as any,
    storage_path: storagePath,
    pr_id: prId,
  });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, extracted: result.analysis?.extracted ?? undefined };
}

export interface ManualQuoteInput {
  prId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  amount: number;
  deliveryTime?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  documentPath?: string | null;
}

/** Capture a quote received outside the platform (email, phone, walk-in PDF). */
export async function addManualQuote(
  input: ManualQuoteInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    if (!input.supplierId && !input.supplierName?.trim()) {
      return { success: false, error: "Choose a supplier or type a name" };
    }
    if (!input.amount || input.amount <= 0) {
      return { success: false, error: "Enter a quote amount greater than zero" };
    }

    const { data: pr, error: prError } = await supabase
      .from("purchase_requisitions")
      .select("id, organization_id")
      .eq("id", input.prId)
      .maybeSingle();

    if (prError || !pr) {
      return { success: false, error: "Requisition not found" };
    }

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        pr_id: input.prId,
        organization_id: pr.organization_id,
        supplier_id: input.supplierId || null,
        supplier_name: input.supplierName?.trim() || null,
        amount: input.amount,
        delivery_time: input.deliveryTime?.trim() || null,
        valid_until: input.validUntil || null,
        notes: input.notes?.trim() || null,
        document_url: input.documentPath || null,
        status: "SUBMITTED",
        source: "MANUAL",
        captured_by: user.id,
      } as any)
      .select("id")
      .single();

    if (error) {
      logError("addManualQuote", error);
      return { success: false, error: getSafeErrorMessage(error) };
    }
    return { success: true, id: (data as any).id };
  } catch (error) {
    logError("addManualQuote", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/** Remove a manually captured quote that has not been accepted. */
export async function deleteManualQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
    if (error) {
      logError("deleteManualQuote", error);
      return { success: false, error: getSafeErrorMessage(error) };
    }
    return { success: true };
  } catch (error) {
    logError("deleteManualQuote", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}
