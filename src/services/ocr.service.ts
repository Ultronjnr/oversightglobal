import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

export type OcrDocumentType = "INVOICE" | "REIMBURSEMENT_PROOF" | "PR_DOCUMENT";
export type OcrStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface OcrExtracted {
  supplier_name?: string;
  supplier_vat_number?: string;
  document_number?: string;
  document_date?: string;
  due_date?: string;
  currency?: string;
  subtotal?: number;
  vat_amount?: number;
  vat_rate?: number;
  total_amount?: number;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  confidence?: number;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    amount?: number;
  }>;
}

export interface OcrAnalysis {
  id: string;
  organization_id: string;
  document_type: OcrDocumentType;
  bucket: string;
  storage_path: string;
  invoice_id: string | null;
  reimbursement_id: string | null;
  pr_id: string | null;
  status: OcrStatus;
  model: string | null;
  extracted: OcrExtracted | null;
  confidence: number | null;
  error_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyzeDocumentInput {
  document_type: OcrDocumentType;
  bucket: "pr-documents" | "reimbursement-documents" | "invoice-documents";
  storage_path: string;
  invoice_id?: string;
  reimbursement_id?: string;
  pr_id?: string;
  force?: boolean;
}

export async function analyzeDocument(
  input: AnalyzeDocumentInput
): Promise<{ success: boolean; analysis?: OcrAnalysis; cached?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-document", {
      body: input,
    });
    if (error) {
      logError("analyzeDocument", error);
      return { success: false, error: getSafeErrorMessage(error) };
    }
    if (!data?.success) {
      return { success: false, error: data?.error || "OCR analysis failed" };
    }
    return { success: true, analysis: data.analysis as OcrAnalysis, cached: !!data.cached };
  } catch (e) {
    logError("analyzeDocument", e);
    return { success: false, error: getSafeErrorMessage(e) };
  }
}

export async function getLatestAnalysisFor(filter: {
  storage_path?: string;
  bucket?: string;
  invoice_id?: string;
  reimbursement_id?: string;
  pr_id?: string;
}): Promise<OcrAnalysis | null> {
  try {
    let q = (supabase as any)
      .from("ocr_analyses")
      .select("*")
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(1);
    if (filter.invoice_id) q = q.eq("invoice_id", filter.invoice_id);
    if (filter.reimbursement_id) q = q.eq("reimbursement_id", filter.reimbursement_id);
    if (filter.pr_id) q = q.eq("pr_id", filter.pr_id);
    if (filter.storage_path) q = q.eq("storage_path", filter.storage_path);
    if (filter.bucket) q = q.eq("bucket", filter.bucket);
    const { data, error } = await q.maybeSingle();
    if (error) {
      logError("getLatestAnalysisFor", error);
      return null;
    }
    return (data as OcrAnalysis) ?? null;
  } catch (e) {
    logError("getLatestAnalysisFor", e);
    return null;
  }
}