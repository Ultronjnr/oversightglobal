import { supabase } from "@/integrations/supabase/client";

export type NetcashStatus =
  | "PENDING" | "SUBMITTED" | "PROCESSING" | "SETTLED" | "FAILED" | "RETRYING" | "CANCELLED";

export interface NetcashPayment {
  id: string;
  organization_id: string;
  batch_id: string | null;
  allocation_id: string | null;
  netcash_reference: string | null;
  amount: number;
  currency: string;
  status: NetcashStatus;
  settled_at: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function netcashStatusLabel(s: NetcashStatus | string | null | undefined): string {
  switch ((s || "").toUpperCase()) {
    case "PENDING": return "Pending";
    case "SUBMITTED": return "Submitted";
    case "PROCESSING": return "Processing";
    case "SETTLED": return "Settled";
    case "FAILED": return "Failed";
    case "RETRYING": return "Retrying";
    case "CANCELLED": return "Cancelled";
    default: return s || "—";
  }
}

/** Submit a confirmed batch to Netcash for supplier payment. */
export async function submitBatchToNetcash(batchId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("netcash-submit-batch", {
    body: { batchId },
  });
  if (error) throw error;
  return data;
}

/** Retry failed allocations in a batch (or a single payment). */
export async function retryNetcashPayment(paymentId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("netcash-retry", {
    body: { paymentId },
  });
  if (error) throw error;
  return data;
}

/** Refresh settlement status for a batch from Netcash. */
export async function pollNetcashStatus(batchId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("netcash-poll-status", {
    body: { batchId },
  });
  if (error) throw error;
  return data;
}

export async function listNetcashPayments(batchId?: string): Promise<NetcashPayment[]> {
  let q = supabase.from("netcash_payments").select("*").order("created_at", { ascending: false });
  if (batchId) q = q.eq("batch_id", batchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as NetcashPayment[];
}

export interface PaymentAuditEntry {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  amount: number | null;
  notes: string | null;
  performed_at: string;
  batch_id: string | null;
}

export async function listPaymentAudit(batchId?: string): Promise<PaymentAuditEntry[]> {
  let q = supabase.from("payment_audit_log").select("*").order("performed_at", { ascending: false }).limit(200);
  if (batchId) q = q.eq("batch_id", batchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PaymentAuditEntry[];
}
