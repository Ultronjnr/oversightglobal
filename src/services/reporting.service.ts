import { supabase } from "@/integrations/supabase/client";

/**
 * Layer 8 — Reporting
 * Supplier statement of account + outstanding payables (aged) report.
 * Read-only aggregation over transactions, payment allocations and batches.
 */

export interface StatementLine {
  id: string;
  date: string;
  reference: string;
  description: string;
  /** Amount invoiced / approved (debit against the org) */
  charge: number;
  /** Amount paid (credit) */
  payment: number;
  running_balance: number;
  type: "CHARGE" | "PAYMENT";
  batch_number?: string | null;
  payment_reference?: string | null;
  status?: string | null;
}

export interface SupplierStatement {
  supplier_id: string;
  supplier_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  vat_number: string | null;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number;
  total_charges: number;
  total_payments: number;
  closing_balance: number;
  lines: StatementLine[];
}

export interface PayableRow {
  transaction_id: string;
  reference: string;
  supplier_id: string | null;
  supplier_name: string;
  currency: string;
  amount: number;
  amount_paid: number;
  outstanding: number;
  due_date: string | null;
  approved_at: string;
  days_outstanding: number;
  bucket: AgingBucket;
  status: string;
  project_name?: string | null;
}

export type AgingBucket = "CURRENT" | "D1_30" | "D31_60" | "D61_90" | "D90_PLUS";

export const AGING_BUCKETS: { key: AgingBucket; label: string }[] = [
  { key: "CURRENT", label: "Current" },
  { key: "D1_30", label: "1 – 30 days" },
  { key: "D31_60", label: "31 – 60 days" },
  { key: "D61_90", label: "61 – 90 days" },
  { key: "D90_PLUS", label: "90+ days" },
];

export interface PayablesReport {
  as_at: string;
  currency: string;
  rows: PayableRow[];
  total_outstanding: number;
  bucket_totals: Record<AgingBucket, number>;
  supplier_totals: { supplier_name: string; outstanding: number }[];
}

const OPEN_STATUSES = [
  "FINANCE_APPROVED",
  "APPROVED_NOT_PAID",
  "AWAITING_PAYMENT",
  "SUPPLIER_INVOICE",
  "INVOICED",
  "PAYMENT_BATCH",
  "PARTIALLY_PAID",
];

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data as any)?.organization_id ?? null;
}

function bucketFor(days: number): AgingBucket {
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "D1_30";
  if (days <= 60) return "D31_60";
  if (days <= 90) return "D61_90";
  return "D90_PLUS";
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Statement of account for one supplier: every charge (approved transaction /
 * supplier invoice) and every payment allocation, in date order, with a
 * running balance.
 */
export async function getSupplierStatement(params: {
  supplierId: string;
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<{ success: boolean; data?: SupplierStatement; error?: string }> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { success: false, error: "Organization not found" };

    const { data: supplier, error: supErr } = await supabase
      .from("suppliers")
      .select("id, company_name, contact_email, phone, vat_number")
      .eq("id", params.supplierId)
      .maybeSingle();
    if (supErr || !supplier) return { success: false, error: "Supplier not found" };

    const { data: txns, error: txErr } = await supabase
      .from("transactions")
      .select(
        "id, amount, amount_paid, currency, status, approved_at, invoiced_at, created_at, pr:purchase_requisitions(transaction_id, payment_due_date)",
      )
      .eq("organization_id", orgId)
      .eq("supplier_id", params.supplierId)
      .order("approved_at", { ascending: true });
    if (txErr) return { success: false, error: txErr.message };

    const txList = (txns as any[]) || [];
    const txIds = txList.map((t) => t.id);

    let allocations: any[] = [];
    if (txIds.length) {
      const { data: allocs } = await supabase
        .from("payment_allocations")
        .select(
          "id, transaction_id, amount_paid, payment_date, payment_reference, created_at, batch:payment_batches(batch_number, status, paid_at)",
        )
        .in("transaction_id", txIds)
        .order("created_at", { ascending: true });
      allocations = (allocs as any[]) || [];
    }

    const start = params.startDate ? new Date(params.startDate) : null;
    const end = params.endDate ? new Date(params.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    type Raw = { date: Date; line: Omit<StatementLine, "running_balance"> };
    const raw: Raw[] = [];

    for (const t of txList) {
      const date = new Date(t.invoiced_at || t.approved_at || t.created_at);
      raw.push({
        date,
        line: {
          id: `tx-${t.id}`,
          date: date.toISOString(),
          reference: t.pr?.transaction_id || t.id.slice(0, 8).toUpperCase(),
          description: "Approved purchase / supplier invoice",
          charge: Number(t.amount || 0),
          payment: 0,
          type: "CHARGE",
          status: t.status,
        },
      });
    }

    for (const a of allocations) {
      const date = new Date(a.payment_date || a.batch?.paid_at || a.created_at);
      const parent = txList.find((t) => t.id === a.transaction_id);
      raw.push({
        date,
        line: {
          id: `pay-${a.id}`,
          date: date.toISOString(),
          reference: parent?.pr?.transaction_id || a.payment_reference || "Payment",
          description: a.batch?.batch_number
            ? `Payment — batch ${a.batch.batch_number}`
            : "Payment",
          charge: 0,
          payment: Number(a.amount_paid || 0),
          type: "PAYMENT",
          batch_number: a.batch?.batch_number ?? null,
          payment_reference: a.payment_reference ?? null,
          status: a.batch?.status ?? null,
        },
      });
    }

    raw.sort((a, b) => a.date.getTime() - b.date.getTime());

    let opening = 0;
    let balance = 0;
    let totalCharges = 0;
    let totalPayments = 0;
    const lines: StatementLine[] = [];

    for (const item of raw) {
      const delta = item.line.charge - item.line.payment;
      if (start && item.date < start) {
        opening += delta;
        balance += delta;
        continue;
      }
      if (end && item.date > end) continue;
      balance += delta;
      totalCharges += item.line.charge;
      totalPayments += item.line.payment;
      lines.push({ ...item.line, running_balance: balance });
    }

    return {
      success: true,
      data: {
        supplier_id: supplier.id,
        supplier_name: (supplier as any).company_name,
        contact_email: (supplier as any).contact_email ?? null,
        contact_phone: (supplier as any).phone ?? null,
        vat_number: (supplier as any).vat_number ?? null,
        currency: txList[0]?.currency || "ZAR",
        period_start: start ? start.toISOString() : null,
        period_end: end ? end.toISOString() : null,
        opening_balance: opening,
        total_charges: totalCharges,
        total_payments: totalPayments,
        closing_balance: balance,
        lines,
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to build statement" };
  }
}

/** Aged outstanding payables across all suppliers. */
export async function getOutstandingPayables(params?: {
  supplierId?: string | null;
  asAt?: Date;
}): Promise<{ success: boolean; data?: PayablesReport; error?: string }> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { success: false, error: "Organization not found" };

    let query = supabase
      .from("transactions")
      .select(
        "id, supplier_id, supplier_name, amount, amount_paid, currency, status, approved_at, invoiced_at, pr:purchase_requisitions(transaction_id, payment_due_date), project:donation_projects(name)",
      )
      .eq("organization_id", orgId)
      .in("status", OPEN_STATUSES);

    if (params?.supplierId) query = query.eq("supplier_id", params.supplierId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const asAt = params?.asAt ? new Date(params.asAt) : new Date();
    const rows: PayableRow[] = [];
    const bucketTotals: Record<AgingBucket, number> = {
      CURRENT: 0,
      D1_30: 0,
      D31_60: 0,
      D61_90: 0,
      D90_PLUS: 0,
    };

    for (const t of (data as any[]) || []) {
      const outstanding = Number(t.amount || 0) - Number(t.amount_paid || 0);
      if (outstanding <= 0.009) continue;
      const due = t.pr?.payment_due_date ? new Date(t.pr.payment_due_date) : null;
      const baseline = due || new Date(t.invoiced_at || t.approved_at);
      const days = daysBetween(baseline, asAt);
      const bucket = bucketFor(days);
      bucketTotals[bucket] += outstanding;
      rows.push({
        transaction_id: t.id,
        reference: t.pr?.transaction_id || t.id.slice(0, 8).toUpperCase(),
        supplier_id: t.supplier_id,
        supplier_name: t.supplier_name || "Unassigned supplier",
        currency: t.currency || "ZAR",
        amount: Number(t.amount || 0),
        amount_paid: Number(t.amount_paid || 0),
        outstanding,
        due_date: t.pr?.payment_due_date ?? null,
        approved_at: t.approved_at,
        days_outstanding: Math.max(days, 0),
        bucket,
        status: t.status,
        project_name: t.project?.name ?? null,
      });
    }

    rows.sort((a, b) => b.days_outstanding - a.days_outstanding);

    const bySupplier = new Map<string, number>();
    rows.forEach((r) =>
      bySupplier.set(r.supplier_name, (bySupplier.get(r.supplier_name) || 0) + r.outstanding),
    );

    return {
      success: true,
      data: {
        as_at: asAt.toISOString(),
        currency: rows[0]?.currency || "ZAR",
        rows,
        total_outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
        bucket_totals: bucketTotals,
        supplier_totals: Array.from(bySupplier.entries())
          .map(([supplier_name, outstanding]) => ({ supplier_name, outstanding }))
          .sort((a, b) => b.outstanding - a.outstanding),
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to build payables report" };
  }
}
