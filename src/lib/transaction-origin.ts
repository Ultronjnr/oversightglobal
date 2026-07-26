/**
 * Transaction origin taxonomy
 * ---------------------------
 * Every payable in the "Approved – Not Paid" queue reaches finance through one
 * of three approval routes. This module is the single source of truth for
 * naming, coding and styling those routes so the UI can always answer
 * "where did this transaction come from?".
 *
 *  SCN — Scanned Invoice (OCR). Finance captured a supplier invoice directly
 *        via Scan AI; it is approved on capture.
 *  SQI — Supplier Quote → Invoice. The PR was sent out for quotes, a quote was
 *        accepted, the supplier invoiced and finance approved that invoice.
 *  DPR — Direct PR Approval. Finance approved the requisition straight from the
 *        Incoming queue via "Approve & Assign Supplier" (no quote round-trip).
 *  REM — Employee Reimbursement (not a PR route, listed for completeness).
 */

export type TransactionOrigin = "SCAN" | "QUOTED" | "DIRECT" | "REIMBURSEMENT";

export interface OriginMeta {
  /** Short code appended to the transaction reference, e.g. PR-20260726-ABCD·SQI */
  code: string;
  label: string;
  description: string;
  /** Tailwind classes for the badge (semantic tokens only) */
  badgeClass: string;
}

export const ORIGIN_META: Record<TransactionOrigin, OriginMeta> = {
  SCAN: {
    code: "SCN",
    label: "Scanned Invoice",
    description: "Captured by Finance with Scan AI (OCR) and approved on capture.",
    badgeClass: "bg-accent/15 text-accent-foreground border-accent/40",
  },
  QUOTED: {
    code: "SQI",
    label: "Quoted → Invoiced",
    description: "Supplier was invited to quote; accepted quote was invoiced and approved.",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
  },
  DIRECT: {
    code: "DPR",
    label: "Direct Approval",
    description: "Approved straight from Incoming PRs via Approve & Assign Supplier.",
    badgeClass: "bg-success/10 text-success border-success/30",
  },
  REIMBURSEMENT: {
    code: "REM",
    label: "Reimbursement",
    description: "Employee out-of-pocket reimbursement awaiting payment.",
    badgeClass: "bg-warning/10 text-warning border-warning/30",
  },
};

/** Reference prefix used for OCR-captured invoices (legacy rows used INV-). */
export const SCAN_REF_PREFIX = "SCN";

export function isScanReference(ref?: string | null): boolean {
  if (!ref) return false;
  return /^(SCN|INV)-/i.test(ref);
}

/**
 * Derive the origin of a payable from data we already have.
 * Priority: reference prefix (scan) → quote trail → direct approval.
 */
export function deriveTransactionOrigin(input: {
  transactionRef?: string | null;
  hasQuote?: boolean;
  kind?: "transaction" | "invoice" | "reimbursement";
}): TransactionOrigin {
  if (input.kind === "reimbursement") return "REIMBURSEMENT";
  if (isScanReference(input.transactionRef)) return "SCAN";
  if (input.hasQuote) return "QUOTED";
  return "DIRECT";
}

/** Display reference with its origin code, e.g. "PR-20260726-ABCD · SQI". */
export function formatTransactionRef(
  ref: string,
  origin: TransactionOrigin,
): string {
  return `${ref} · ${ORIGIN_META[origin].code}`;
}
