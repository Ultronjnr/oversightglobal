import { supabase } from "@/integrations/supabase/client";
import type { PurchaseRequisition, PRStatus, UrgencyLevel } from "@/types/pr.types";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

export interface PRHistoryFilters {
  status?: PRStatus | "ALL";
  urgency?: UrgencyLevel | "ALL";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface PRHistoryResult {
  success: boolean;
  data: PurchaseRequisition[];
  totalCount: number;
  error?: string;
}

/**
 * Get PR history with filtering, search, and pagination
 * Respects RLS - returns different data based on user role
 */
export async function getPRHistory(
  role: string,
  userId: string,
  department: string | null,
  filters: PRHistoryFilters = {},
  page: number = 1,
  pageSize: number = 10
): Promise<PRHistoryResult> {
  try {
    // Get the user's organization first
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (!profile?.organization_id) {
      return { success: false, error: "User organization not found", data: [], totalCount: 0 };
    }

    // Build base query - RLS will filter based on role automatically
    let query = supabase
      .from("purchase_requisitions")
      .select("*", { count: "exact" });

    // Apply status filter
    if (filters.status && filters.status !== "ALL") {
      query = query.eq("status", filters.status);
    }

    // Apply urgency filter
    if (filters.urgency && filters.urgency !== "ALL") {
      query = query.eq("urgency", filters.urgency);
    }

    // Apply date range filter
    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }
    if (filters.dateTo) {
      // Add one day to include the end date fully
      const endDate = new Date(filters.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("created_at", endDate.toISOString());
    }

    // Apply search filter (transaction_id or requested_by_name)
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.or(`transaction_id.ilike.${searchTerm},requested_by_name.ilike.${searchTerm}`);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Order and paginate
    query = query
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logError("getPRHistory", error);
      return { success: false, error: getSafeErrorMessage(error), data: [], totalCount: 0 };
    }

    return {
      success: true,
      data: (data || []) as unknown as PurchaseRequisition[],
      totalCount: count || 0,
    };
  } catch (error) {
    logError("getPRHistory", error);
    return { success: false, error: getSafeErrorMessage(error), data: [], totalCount: 0 };
  }
}

/**
 * Export PR history to CSV format
 */
export function exportPRHistoryToCSV(prs: PurchaseRequisition[]): string {
  const headers = [
    "Transaction ID",
    "Requester",
    "Department",
    "Total Amount",
    "Currency",
    "Urgency",
    "Status",
    "HOD Status",
    "Finance Status",
    "Created Date",
    "Due Date",
  ];

  const rows = prs.map((pr) => [
    pr.transaction_id,
    pr.requested_by_name,
    pr.requested_by_department || "N/A",
    pr.total_amount.toString(),
    pr.currency,
    pr.urgency,
    pr.status,
    pr.hod_status,
    pr.finance_status,
    new Date(pr.created_at).toLocaleDateString(),
    pr.due_date ? new Date(pr.due_date).toLocaleDateString() : "N/A",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}
