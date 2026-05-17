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

export interface ReimbursementAuditEntry {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  performed_at: string;
  performed_by: string | null;
}

export async function getReimbursementAuditLog(
  reimbursementId: string,
): Promise<ReimbursementAuditEntry[]> {
  const { data, error } = await supabase
    .from("reimbursement_audit_log")
    .select("id, action, old_status, new_status, notes, performed_at, performed_by")
    .eq("reimbursement_id", reimbursementId)
    .order("performed_at", { ascending: true });
  if (error) {
    logError("getReimbursementAuditLog", error);
    return [];
  }
  return (data || []) as ReimbursementAuditEntry[];
}

export interface LinkedPRSummary {
  id: string;
  transaction_id: string;
  total_amount: number;
  currency: string;
  status: string;
  requested_by_name: string;
  created_at: string;
}

export async function getLinkedPRSummary(prId: string): Promise<LinkedPRSummary | null> {
  const { data, error } = await supabase
    .from("purchase_requisitions")
    .select("id, transaction_id, total_amount, currency, status, requested_by_name, created_at")
    .eq("id", prId)
    .maybeSingle();
  if (error) {
    logError("getLinkedPRSummary", error);
    return null;
  }
  return (data as unknown as LinkedPRSummary) || null;
}

export const REIMBURSEMENT_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "PERSONAL_CARD", label: "Personal Card" },
  { value: "EFT", label: "EFT / Bank Transfer" },
  { value: "OTHER", label: "Other" },
] as const;

// ---------- Finance sub-tab buckets ----------

export type ReimbursementBucket = "PENDING" | "AWAITING_PAYMENT" | "PAID";

/**
 * Canonical mapping of UI buckets -> underlying statuses.
 * - PENDING: newly submitted, awaiting finance review
 * - AWAITING_PAYMENT: finance-approved, not yet paid (covers both APPROVED and
 *   the explicit AWAITING_PAYMENT transitional state)
 * - PAID: completed payouts only
 * DECLINED/REJECTED are intentionally excluded from active sub-tabs.
 */
export const REIMBURSEMENT_BUCKET_STATUSES: Record<ReimbursementBucket, ReimbursementStatus[]> = {
  PENDING: ["PENDING"],
  AWAITING_PAYMENT: ["APPROVED", "AWAITING_PAYMENT"],
  PAID: ["PAID"],
};

export interface ReimbursementPage {
  rows: Reimbursement[];
  total: number;
}

export async function getOrgReimbursementsByBucket(
  bucket: ReimbursementBucket,
  opts: { limit?: number; offset?: number } = {}
): Promise<ReimbursementPage> {
  const { limit = 25, offset = 0 } = opts;
  const statuses = REIMBURSEMENT_BUCKET_STATUSES[bucket];
  const { data, error, count } = await supabase
    .from("reimbursements")
    .select("*", { count: "exact" })
    .in("status", statuses as any)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    logError("getOrgReimbursementsByBucket", error);
    return { rows: [], total: 0 };
  }
  return { rows: (data || []) as unknown as Reimbursement[], total: count ?? 0 };
}

export async function getOrgReimbursementBucketCounts(): Promise<
  Record<ReimbursementBucket, number>
> {
  const buckets: ReimbursementBucket[] = ["PENDING", "AWAITING_PAYMENT", "PAID"];
  const results = await Promise.all(
    buckets.map(async (b) => {
      const { count } = await supabase
        .from("reimbursements")
        .select("id", { count: "exact", head: true })
        .in("status", REIMBURSEMENT_BUCKET_STATUSES[b] as any);
      return [b, count ?? 0] as const;
    })
  );
  return Object.fromEntries(results) as Record<ReimbursementBucket, number>;
}