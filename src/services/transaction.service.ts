import { supabase } from "@/integrations/supabase/client";

export type TransactionStatus =
  | "REQUEST_CREATED"
  | "FINANCE_APPROVED"
  | "SUPPLIER_QUOTE"
  | "QUOTE_ACCEPTED"
  | "SUPPLIER_INVOICE"
  | "AWAITING_PAYMENT"
  | "PAYMENT_BATCH"
  | "PAID"
  | "COMPLETED"
  | "APPROVED_NOT_PAID"
  | "INVOICED"
  | "PARTIALLY_PAID"
  | "FULLY_PAID";

const STATUS_COMPAT: Record<TransactionStatus, TransactionStatus[]> = {
  REQUEST_CREATED: ["REQUEST_CREATED"],
  FINANCE_APPROVED: ["FINANCE_APPROVED", "APPROVED_NOT_PAID"],
  SUPPLIER_QUOTE: ["SUPPLIER_QUOTE"],
  QUOTE_ACCEPTED: ["QUOTE_ACCEPTED"],
  SUPPLIER_INVOICE: ["SUPPLIER_INVOICE", "INVOICED"],
  AWAITING_PAYMENT: ["AWAITING_PAYMENT", "APPROVED_NOT_PAID", "INVOICED", "PARTIALLY_PAID"],
  PAYMENT_BATCH: ["PAYMENT_BATCH", "PARTIALLY_PAID"],
  PAID: ["PAID", "FULLY_PAID"],
  COMPLETED: ["COMPLETED", "FULLY_PAID"],
  APPROVED_NOT_PAID: ["FINANCE_APPROVED", "APPROVED_NOT_PAID"],
  INVOICED: ["SUPPLIER_INVOICE", "AWAITING_PAYMENT", "INVOICED"],
  PARTIALLY_PAID: ["PAYMENT_BATCH", "PARTIALLY_PAID"],
  FULLY_PAID: ["PAID", "COMPLETED", "FULLY_PAID"],
};

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
  const expandedStatuses = Array.from(
    new Set(statuses.flatMap((status) => STATUS_COMPAT[status] ?? [status])),
  );

  const { data, error } = await supabase
    .from("transactions" as any)
    .select(
      "*, pr:purchase_requisitions(id, transaction_id, requested_by_name, requested_by_department, payment_due_date, items, document_url, total_amount, currency), invoice:invoices(id, document_url, status, quote:quotes(id, amount, transaction_id), supplier:suppliers(id, company_name, contact_email))",
    )
    .in("status", expandedStatuses)
    .order("approved_at", { ascending: false });
  if (error) {
    console.error("getTransactionsByStatus error", error);
    return [];
  }
  return (data as unknown as OrgTransaction[]) || [];
}