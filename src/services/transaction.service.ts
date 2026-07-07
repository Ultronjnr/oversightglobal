import { supabase } from "@/integrations/supabase/client";

export type TransactionStatus =
  | "APPROVED_NOT_PAID"
  | "INVOICED"
  | "PARTIALLY_PAID"
  | "FULLY_PAID";

export interface OrgTransaction {
  id: string;
  pr_id: string;
  organization_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  amount: number;
  currency: string;
  amount_paid: number;
  status: TransactionStatus;
  approved_at: string;
  paid_at: string | null;
  invoice_id: string | null;
  document_url: string | null;
  invoiced_at: string | null;
  created_at: string;
  updated_at: string;
  pr?: {
    id: string;
    transaction_id: string;
    requested_by_name: string;
    requested_by_department: string | null;
    payment_due_date: string | null;
    items: any;
    document_url: string | null;
    total_amount: number;
    currency: string;
  } | null;
}

export async function getTransactionsByStatus(
  statuses: TransactionStatus[],
): Promise<OrgTransaction[]> {
  const { data, error } = await supabase
    .from("transactions" as any)
    .select(
      "*, pr:purchase_requisitions(id, transaction_id, requested_by_name, requested_by_department, payment_due_date, items, document_url, total_amount, currency)",
    )
    .in("status", statuses)
    .order("approved_at", { ascending: false });
  if (error) {
    console.error("getTransactionsByStatus error", error);
    return [];
  }
  return (data as unknown as OrgTransaction[]) || [];
}