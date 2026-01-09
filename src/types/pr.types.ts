// Purchase Requisition Types

export type PRStatus =
  | "PENDING_HOD_APPROVAL"
  | "HOD_APPROVED"
  | "HOD_DECLINED"
  | "PENDING_FINANCE_APPROVAL"
  | "FINANCE_APPROVED"
  | "FINANCE_DECLINED"
  | "SPLIT";

export type UrgencyLevel = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface PRItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  supplier_preference?: string;
}

export interface PRHistoryEntry {
  action: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  details?: string;
}

export interface CreatePRInput {
  items: PRItem[];
  urgency: UrgencyLevel;
  department: string;
  supplier_preference?: string;
  due_date?: string;
  payment_due_date?: string;
  document_url?: string;
}

export interface PurchaseRequisition {
  id: string;
  transaction_id: string;
  organization_id: string;
  requested_by: string;
  requested_by_name: string;
  requested_by_department: string | null;
  items: PRItem[];
  total_amount: number;
  currency: string;
  urgency: UrgencyLevel;
  hod_status: string;
  finance_status: string;
  status: PRStatus;
  due_date: string | null;
  payment_due_date: string | null;
  document_url: string | null;
  parent_pr_id: string | null;
  history: PRHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface CreatePRResult {
  success: boolean;
  data?: PurchaseRequisition;
  error?: string;
}
