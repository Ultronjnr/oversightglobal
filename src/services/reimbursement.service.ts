import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";
import { v4 as uuidv4 } from "uuid";

export type ReimbursementStatus =
  | "PENDING"
  | "APPROVED"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "REJECTED"
  | "DECLINED";

export interface Reimbursement {
  id: string;
  organization_id: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  currency: string;
  description: string;
  proof_document_url: string | null;
  status: ReimbursementStatus;
  paid_by_employee: boolean;
  pr_id: string | null;
  payment_method: string | null;
  reimbursement_reference: string | null;
  reimbursement_date: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitReimbursementInput {
  pr_id: string;
  amount: number;
  description: string;
  payment_method: string;
  reference?: string;
  reimbursement_date?: string;
  proof_file: File;
  notes?: string;
}

async function uploadProof(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}-${uuidv4()}.${ext}`;
  const { error } = await supabase.storage
    .from("reimbursement-documents")
    .upload(path, file);
  if (error) {
    logError("uploadProof", error);
    return null;
  }
  return path;
}

export async function submitReimbursementForPR(input: SubmitReimbursementInput) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const proofPath = await uploadProof(input.proof_file, user.id);
    if (!proofPath) return { success: false, error: "Failed to upload proof document" };

    const { data, error } = await supabase.rpc(
      "submit_reimbursement_for_pr" as any,
      {
        _pr_id: input.pr_id,
        _amount: input.amount,
        _description: input.description,
        _payment_method: input.payment_method,
        _reference: input.reference ?? null,
        _reimbursement_date: input.reimbursement_date ?? null,
        _proof_url: proofPath,
        _notes: input.notes ?? null,
      } as any
    );
    if (error) return { success: false, error: getSafeErrorMessage(error) };
    const result = data as any;
    if (!result?.success) return { success: false, error: result?.error || "Failed" };
    return { success: true, reimbursement_id: result.reimbursement_id as string };
  } catch (e) {
    return { success: false, error: getSafeErrorMessage(e) };
  }
}

export async function approveReimbursement(id: string, notes?: string) {
  const { data, error } = await supabase.rpc("approve_reimbursement" as any, {
    _reimbursement_id: id,
    _notes: notes ?? null,
  } as any);
  if (error) return { success: false, error: getSafeErrorMessage(error) };
  const r = data as any;
  return r?.success ? { success: true } : { success: false, error: r?.error || "Failed" };
}

export async function rejectReimbursement(id: string, notes?: string) {
  const { data, error } = await supabase.rpc("reject_reimbursement" as any, {
    _reimbursement_id: id,
    _notes: notes ?? null,
  } as any);
  if (error) return { success: false, error: getSafeErrorMessage(error) };
  const r = data as any;
  return r?.success ? { success: true } : { success: false, error: r?.error || "Failed" };
}

export async function markReimbursementPaid(
  id: string,
  reference?: string,
  date?: string
) {
  const { data, error } = await supabase.rpc("mark_reimbursement_paid" as any, {
    _reimbursement_id: id,
    _payment_reference: reference ?? null,
    _payment_date: date ?? null,
  } as any);
  if (error) return { success: false, error: getSafeErrorMessage(error) };
  const r = data as any;
  return r?.success ? { success: true } : { success: false, error: r?.error || "Failed" };
}

export async function getMyReimbursements(): Promise<Reimbursement[]> {
  const { data, error } = await supabase
    .from("reimbursements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    logError("getMyReimbursements", error);
    return [];
  }
  return (data || []) as unknown as Reimbursement[];
}

export async function getOrgReimbursements(
  statusFilter?: ReimbursementStatus[]
): Promise<Reimbursement[]> {
  let q = supabase.from("reimbursements").select("*").order("created_at", { ascending: false });
  if (statusFilter && statusFilter.length > 0) {
    q = q.in("status", statusFilter as any);
  }
  const { data, error } = await q;
  if (error) {
    logError("getOrgReimbursements", error);
    return [];
  }
  return (data || []) as unknown as Reimbursement[];
}

export async function getReimbursementProofUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("reimbursement-documents")
    .createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export const REIMBURSEMENT_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "PERSONAL_CARD", label: "Personal Card" },
  { value: "EFT", label: "EFT / Bank Transfer" },
  { value: "OTHER", label: "Other" },
] as const;