import { supabase } from "@/integrations/supabase/client";

export type ExpensePaymentStatus =
  | "APPROVED_NOT_PAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID";

export interface ExpenseRecord {
  id: string;
  transactionId: string;
  prId: string;
  title: string;
  supplierName: string;
  supplierVatNumber: string | null;
  categoryId: string | null;
  categoryName: string;
  categoryType: "EXPENSE" | "ASSET" | "UNCATEGORIZED";
  department: string;
  amount: number;
  vatAmount: number;
  vatClaimable: boolean;
  currency: string;
  approvalDate: string;
  paymentStatus: ExpensePaymentStatus;
  amountPaid: number;
}

const VAT_RATE = 0.15;

function computeVat(amount: number, claimable: boolean): number {
  if (!claimable || !amount) return 0;
  // ZA inclusive VAT: amount * 15/115
  return +(amount * (VAT_RATE / (1 + VAT_RATE))).toFixed(2);
}

export interface ExpenseFilters {
  from?: string; // ISO date
  to?: string;
  categoryId?: string | "ALL";
  paymentStatus?: ExpensePaymentStatus | "ALL";
  vatClaimable?: "ALL" | "CLAIMABLE" | "NON_CLAIMABLE";
}

export async function getExpenses(
  filters: ExpenseFilters = {},
): Promise<{ success: boolean; data: ExpenseRecord[]; error?: string }> {
  try {
    let query = supabase
      .from("transactions" as any)
      .select(
        `id, pr_id, amount, amount_paid, currency, status, approved_at, supplier_id, supplier_name,
         supplier:suppliers(company_name, vat_number),
         pr:purchase_requisitions(transaction_id, requested_by_name, requested_by_department, items, category_id, category:categories(id, name, type))`,
      )
      .order("approved_at", { ascending: false });

    if (filters.from) query = query.gte("approved_at", filters.from);
    if (filters.to) query = query.lte("approved_at", filters.to);
    if (filters.paymentStatus && filters.paymentStatus !== "ALL") {
      query = query.eq("status", filters.paymentStatus);
    }

    const { data, error } = await query;
    if (error) throw error;

    let records: ExpenseRecord[] = (data as any[] || []).map((t) => {
      const supplierVat = t.supplier?.vat_number || null;
      const supplierName =
        t.supplier?.company_name ||
        t.supplier_name ||
        t.pr?.requested_by_name ||
        "Unspecified";
      const claimable = !!supplierVat;
      const amount = Number(t.amount || 0);
      const firstItem =
        Array.isArray(t.pr?.items) && t.pr.items.length > 0
          ? t.pr.items[0]?.description
          : null;
      const title = firstItem
        ? `${firstItem}${t.pr.items.length > 1 ? ` (+${t.pr.items.length - 1} more)` : ""}`
        : t.pr?.transaction_id || "Transaction";
      return {
        id: t.id,
        prId: t.pr_id,
        transactionId: t.pr?.transaction_id || t.id.slice(0, 8),
        title,
        supplierName,
        supplierVatNumber: supplierVat,
        categoryId: t.pr?.category?.id || t.pr?.category_id || null,
        categoryName: t.pr?.category?.name || "Uncategorized",
        categoryType: (t.pr?.category?.type as any) || "UNCATEGORIZED",
        department: t.pr?.requested_by_department || "Unassigned",
        amount,
        amountPaid: Number(t.amount_paid || 0),
        vatAmount: computeVat(amount, claimable),
        vatClaimable: claimable,
        currency: t.currency || "ZAR",
        approvalDate: t.approved_at,
        paymentStatus: (t.status as ExpensePaymentStatus) || "APPROVED_NOT_PAID",
      };
    });

    if (filters.categoryId && filters.categoryId !== "ALL") {
      records = records.filter((r) => r.categoryId === filters.categoryId);
    }
    if (filters.vatClaimable && filters.vatClaimable !== "ALL") {
      const want = filters.vatClaimable === "CLAIMABLE";
      records = records.filter((r) => r.vatClaimable === want);
    }

    return { success: true, data: records };
  } catch (err: any) {
    console.error("getExpenses error", err);
    return { success: false, data: [], error: err.message };
  }
}

export interface CategorySummary {
  categoryId: string | null;
  categoryName: string;
  categoryType: "EXPENSE" | "ASSET" | "UNCATEGORIZED";
  totalSpent: number;
  totalVat: number;
  count: number;
  monthly: Record<string, number>; // "YYYY-MM" -> amount
}

export function summarizeByCategory(
  records: ExpenseRecord[],
): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const r of records) {
    const key = r.categoryId || `__${r.categoryName}`;
    const existing =
      map.get(key) ||
      ({
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        categoryType: r.categoryType,
        totalSpent: 0,
        totalVat: 0,
        count: 0,
        monthly: {},
      } as CategorySummary);
    existing.totalSpent += r.amount;
    existing.totalVat += r.vatAmount;
    existing.count += 1;
    const month = r.approvalDate ? r.approvalDate.slice(0, 7) : "unknown";
    existing.monthly[month] = (existing.monthly[month] || 0) + r.amount;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}