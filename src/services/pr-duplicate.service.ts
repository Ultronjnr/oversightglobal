import { supabase } from "@/integrations/supabase/client";
import type { PRItem } from "@/types/pr.types";

export interface DuplicateCandidate {
  id: string;
  transaction_id: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  requested_by_name: string;
  itemSummary: string;
  reasons: string[];
}

const WINDOW_DAYS = 30;
const AMOUNT_TOLERANCE = 0.01; // 1%

function normalise(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function itemSignature(items: PRItem[]): string[] {
  return items.map((i) => normalise(i.description || "")).filter(Boolean);
}

/**
 * Look for same-organisation purchase requisitions raised in the last 30 days
 * that closely match the one being submitted/approved (similar total and
 * overlapping line-item descriptions).
 */
export async function findDuplicatePRs(params: {
  items: PRItem[];
  totalAmount: number;
  /** Exclude this PR id (used when checking at approval time). */
  excludePrId?: string;
}): Promise<DuplicateCandidate[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("purchase_requisitions")
    .select(
      "id, transaction_id, total_amount, currency, status, created_at, requested_by_name, items",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  const mySignature = itemSignature(params.items);

  const candidates: DuplicateCandidate[] = [];

  for (const row of data as any[]) {
    if (params.excludePrId && row.id === params.excludePrId) continue;

    const reasons: string[] = [];

    const rowTotal = Number(row.total_amount) || 0;
    const diff = Math.abs(rowTotal - params.totalAmount);
    const amountMatches =
      params.totalAmount > 0 && diff <= Math.max(params.totalAmount * AMOUNT_TOLERANCE, 0.5);
    if (amountMatches) reasons.push("Same total amount");

    const rowItems = Array.isArray(row.items) ? (row.items as PRItem[]) : [];
    const rowSignature = itemSignature(rowItems);
    const overlap = mySignature.filter((s) => rowSignature.includes(s));
    if (overlap.length > 0) {
      reasons.push(
        overlap.length === mySignature.length && overlap.length === rowSignature.length
          ? "Identical line items"
          : `${overlap.length} matching line item${overlap.length > 1 ? "s" : ""}`,
      );
    }

    // Flag only when both signals agree, or the line items are an exact match.
    const isDuplicate =
      (amountMatches && overlap.length > 0) ||
      (overlap.length > 0 &&
        overlap.length === mySignature.length &&
        overlap.length === rowSignature.length);

    if (!isDuplicate) continue;

    candidates.push({
      id: row.id,
      transaction_id: row.transaction_id,
      total_amount: rowTotal,
      currency: row.currency || "ZAR",
      status: row.status,
      created_at: row.created_at,
      requested_by_name: row.requested_by_name,
      itemSummary: rowItems
        .map((i) => i.description)
        .filter(Boolean)
        .slice(0, 3)
        .join(", "),
      reasons,
    });

    if (candidates.length >= 5) break;
  }

  return candidates;
}
