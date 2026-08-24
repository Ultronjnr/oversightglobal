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
  vat_status: VatStatusValue;
  vat_flags: VatFlagCode[];
  vat_note: string | null;
  vat_assessment_required: boolean;
  has_document: boolean;
  created_at: string;
  invoiced_at: string | null;
  paid_at: string | null;
}

/** VAT status is derived by the system from the attached invoice — never chosen by hand. */
export type VatStatusValue =
  | "UNASSESSED"
  | "STANDARD"
  | "ZERO_RATED"
  | "EXEMPT"
  | "NOT_REGISTERED";

export type VatFlagCode =
  | "VAT_CHARGED_WITHOUT_REGISTRATION"
  | "INCORRECT_VAT_RATE"
  | "TOTALS_MISMATCH"
  | "MISSING_VAT_AMOUNT"
  | "NO_INVOICE";

export const VAT_STATUS_LABEL: Record<VatStatusValue, string> = {
  UNASSESSED: "Not assessed",
  STANDARD: "Standard-rated (15%)",
  ZERO_RATED: "Zero-rated (0%)",
  EXEMPT: "Exempt",
  NOT_REGISTERED: "Supplier not VAT registered",
};

export const VAT_FLAG_LABEL: Record<VatFlagCode, string> = {
  VAT_CHARGED_WITHOUT_REGISTRATION:
    "VAT charged but the supplier has no VAT number — input VAT is not claimable",
  INCORRECT_VAT_RATE: "VAT rate is not the SARS standard 15% or 0%",
  TOTALS_MISMATCH: "Net + VAT does not equal the invoice total",
  MISSING_VAT_AMOUNT: "Invoice attached but no VAT amount was extracted",
  NO_INVOICE: "No invoice attached yet — VAT cannot be assessed",
};

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
        "id, pr_id, supplier_id, supplier_name, vat_number, status, currency, vat_rate, vat_amount, exclusive_amount, inclusive_amount, vat_manual, vat_status, vat_flags, vat_note, vat_assessment_required, document_url, invoice_id, scan_document_path, created_at, invoiced_at, paid_at, supplier:suppliers(vat_number, company_name)"
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
        vat_status: (t.vat_status || "UNASSESSED") as VatStatusValue,
        vat_flags: (t.vat_flags || []) as VatFlagCode[],
        vat_note: t.vat_note ?? null,
        vat_assessment_required: !!t.vat_assessment_required,
        has_document: !!(t.document_url || t.invoice_id || t.scan_document_path),
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

export interface VatAssessment {
  status: VatStatusValue;
  flags: VatFlagCode[];
  note: string;
}

export interface VatAssessmentInput {
  hasDocument: boolean;
  vatNumber?: string | null;
  vatAmount: number;
  exclusiveAmount: number;
  inclusiveAmount: number;
}

/**
 * Derive the VAT treatment of a transaction from the attached invoice.
 * There is no manual VAT selection anywhere in the product — this is the single
 * source of truth and it only runs once a document is attached.
 */
export function assessVat(input: VatAssessmentInput): VatAssessment {
  if (!input.hasDocument) {
    return {
      status: "UNASSESSED",
      flags: ["NO_INVOICE"],
      note: "VAT is only assessed once an invoice or receipt is attached.",
    };
  }

  const registered = !!input.vatNumber?.toString().trim();
  const vat = Number(input.vatAmount) || 0;
  const inclusive = Number(input.inclusiveAmount) || 0;
  const exclusive =
    Number(input.exclusiveAmount) || Number((inclusive - vat).toFixed(2));
  const flags: VatFlagCode[] = [];

  if (Math.abs(exclusive + vat - inclusive) > 0.05) flags.push("TOTALS_MISMATCH");

  if (!registered) {
    if (vat > 0.005) flags.push("VAT_CHARGED_WITHOUT_REGISTRATION");
    return {
      status: "NOT_REGISTERED",
      flags,
      note: registered
        ? ""
        : "No supplier VAT number on the invoice — treated as a non-VAT supply.",
    };
  }

  if (vat <= 0.005) {
    return {
      status: "ZERO_RATED",
      flags,
      note: "Supplier is VAT registered but charged no VAT — zero-rated or exempt supply.",
    };
  }

  const rate = exclusive > 0 ? (vat / exclusive) * 100 : 0;
  if (Math.abs(rate - 15) > 0.6) flags.push("INCORRECT_VAT_RATE");

  return {
    status: "STANDARD",
    flags,
    note: `Standard-rated supply at an effective ${rate.toFixed(2)}%.`,
  };
}

/** Assess one transaction and persist the derived status/flags. */
export async function assessTransactionVat(
  id: string
): Promise<{ success: boolean; assessment?: VatAssessment; error?: string }> {
  const { data, error } = await supabase
    .from("transactions" as any)
    .select(
      "id, vat_number, vat_amount, exclusive_amount, inclusive_amount, amount, document_url, invoice_id, scan_document_path, supplier:suppliers(vat_number)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Transaction not found" };

  const t = data as any;
  const inclusive = num(t.inclusive_amount, num(t.amount));
  const assessment = assessVat({
    hasDocument: !!(t.document_url || t.invoice_id || t.scan_document_path),
    vatNumber: t.vat_number || t.supplier?.vat_number || null,
    vatAmount: num(t.vat_amount),
    exclusiveAmount: num(t.exclusive_amount),
    inclusiveAmount: inclusive,
  });

  const { error: upErr } = await supabase
    .from("transactions" as any)
    .update({
      vat_status: assessment.status,
      vat_flags: assessment.flags,
      vat_note: assessment.note || null,
      vat_assessed_at: new Date().toISOString(),
      vat_assessment_required: false,
    })
    .eq("id", id);
  if (upErr) return { success: false, error: upErr.message };
  return { success: true, assessment };
}

/** Assess every transaction the database has flagged as needing a fresh assessment. */
export async function assessPendingVat(): Promise<{
  success: boolean;
  assessed: number;
  error?: string;
}> {
  const { data, error } = await supabase
    .from("transactions" as any)
    .select("id")
    .eq("vat_assessment_required", true)
    .limit(200);
  if (error) return { success: false, assessed: 0, error: error.message };

  let assessed = 0;
  for (const row of (data || []) as { id: string }[]) {
    const res = await assessTransactionVat(row.id);
    if (res.success) assessed += 1;
  }
  return { success: true, assessed };
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
