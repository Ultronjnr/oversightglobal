import { supabase } from "@/integrations/supabase/client";

/** Statuses that represent VAT already payable/paid and therefore recoverable. */
const RECOVERABLE_STATUSES = ["PAID", "COMPLETED"];
/** Statuses where the supplier invoice exists but payment is still outstanding. */
const OUTSTANDING_STATUSES = ["SUPPLIER_INVOICE", "AWAITING_PAYMENT", "PAYMENT_BATCH"];

export interface VatTransaction {
  id: string;
  pr_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  vat_number: string | null;
  status: string;
  currency: string;
  vat_rate: number;
  vat_amount: number;
  exclusive_amount: number;
  inclusive_amount: number;
  vat_manual: boolean;
  created_at: string;
  invoiced_at: string | null;
  paid_at: string | null;
}

export interface VatUpdate {
  vat_rate?: number;
  vat_amount?: number;
  exclusive_amount?: number;
  inclusive_amount?: number;
}

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Compute a consistent VAT split from an inclusive gross amount + rate. */
export function computeVatFromInclusive(inclusive: number, rate: number) {
  const r = rate / 100;
  const exclusive = r > 0 ? inclusive / (1 + r) : inclusive;
  const vat = inclusive - exclusive;
  return {
    inclusive_amount: Number(inclusive.toFixed(2)),
    exclusive_amount: Number(exclusive.toFixed(2)),
    vat_amount: Number(vat.toFixed(2)),
  };
}

export async function listVatTransactions(): Promise<{
  success: boolean;
  data: VatTransaction[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("transactions" as any)
      .select(
        "id, pr_id, supplier_id, supplier_name, vat_number, status, currency, vat_rate, vat_amount, exclusive_amount, inclusive_amount, vat_manual, created_at, invoiced_at, paid_at, supplier:suppliers(vat_number, company_name)"
      )
      .order("created_at", { ascending: false });
    if (error) return { success: false, data: [], error: error.message };

    const rows: VatTransaction[] = (data || []).map((t: any) => {
      const inclusive = num(t.inclusive_amount, num(t.amount));
      const rate = num(t.vat_rate, 15);
      const fallback = computeVatFromInclusive(inclusive, rate);
      return {
        id: t.id,
        pr_id: t.pr_id,
        supplier_id: t.supplier_id,
        supplier_name: t.supplier_name || t.supplier?.company_name || "—",
        vat_number: t.vat_number || t.supplier?.vat_number || null,
        status: t.status,
        currency: t.currency || "ZAR",
        vat_rate: rate,
        vat_amount: t.vat_amount != null ? num(t.vat_amount) : fallback.vat_amount,
        exclusive_amount:
          t.exclusive_amount != null ? num(t.exclusive_amount) : fallback.exclusive_amount,
        inclusive_amount: inclusive,
        vat_manual: !!t.vat_manual,
        created_at: t.created_at,
        invoiced_at: t.invoiced_at,
        paid_at: t.paid_at,
      };
    });
    return { success: true, data: rows };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/** Persist manually-edited VAT figures on a transaction. */
export async function updateTransactionVat(
  id: string,
  update: VatUpdate
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, unknown> = { vat_manual: true };
  if (update.vat_rate != null) payload.vat_rate = update.vat_rate;
  if (update.vat_amount != null) payload.vat_amount = update.vat_amount;
  if (update.exclusive_amount != null) payload.exclusive_amount = update.exclusive_amount;
  if (update.inclusive_amount != null) payload.inclusive_amount = update.inclusive_amount;
  const { error } = await supabase
    .from("transactions" as any)
    .update(payload)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export const isRecoverable = (status: string) => RECOVERABLE_STATUSES.includes(status);
export const isOutstanding = (status: string) => OUTSTANDING_STATUSES.includes(status);

export interface VatGroup {
  key: string;
  label: string;
  count: number;
  exclusive: number;
  vat: number;
  inclusive: number;
  recoverable: number;
  outstanding: number;
}

export interface VatSummary {
  totalVat: number;
  totalExclusive: number;
  totalInclusive: number;
  recoverableVat: number;
  outstandingVat: number;
  bySupplier: VatGroup[];
  byMonth: VatGroup[];
}

export function summariseVat(rows: VatTransaction[]): VatSummary {
  let totalVat = 0,
    totalExclusive = 0,
    totalInclusive = 0,
    recoverableVat = 0,
    outstandingVat = 0;

  const suppliers = new Map<string, VatGroup>();
  const months = new Map<string, VatGroup>();

  for (const r of rows) {
    totalVat += r.vat_amount;
    totalExclusive += r.exclusive_amount;
    totalInclusive += r.inclusive_amount;
    const rec = isRecoverable(r.status) ? r.vat_amount : 0;
    const out = isOutstanding(r.status) ? r.vat_amount : 0;
    recoverableVat += rec;
    outstandingVat += out;

    const sKey = r.supplier_id || r.supplier_name || "unknown";
    const s = suppliers.get(sKey) || {
      key: sKey,
      label: r.supplier_name || "—",
      count: 0,
      exclusive: 0,
      vat: 0,
      inclusive: 0,
      recoverable: 0,
      outstanding: 0,
    };
    s.count += 1;
    s.exclusive += r.exclusive_amount;
    s.vat += r.vat_amount;
    s.inclusive += r.inclusive_amount;
    s.recoverable += rec;
    s.outstanding += out;
    suppliers.set(sKey, s);

    const d = r.invoiced_at || r.created_at;
    const mKey = d ? d.slice(0, 7) : "unknown";
    const m = months.get(mKey) || {
      key: mKey,
      label: mKey,
      count: 0,
      exclusive: 0,
      vat: 0,
      inclusive: 0,
      recoverable: 0,
      outstanding: 0,
    };
    m.count += 1;
    m.exclusive += r.exclusive_amount;
    m.vat += r.vat_amount;
    m.inclusive += r.inclusive_amount;
    m.recoverable += rec;
    m.outstanding += out;
    months.set(mKey, m);
  }

  return {
    totalVat,
    totalExclusive,
    totalInclusive,
    recoverableVat,
    outstandingVat,
    bySupplier: [...suppliers.values()].sort((a, b) => b.vat - a.vat),
    byMonth: [...months.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
