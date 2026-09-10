import { supabase } from "@/integrations/supabase/client";

export type PaymentBucketKey =
  | "APPROVED_NOT_PAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "OVERDUE";

export interface PaymentBucket {
  key: PaymentBucketKey;
  count: number;
  total: number;
}

export type PaymentBuckets = Record<PaymentBucketKey, PaymentBucket>;

const empty = (): PaymentBuckets => ({
  APPROVED_NOT_PAID: { key: "APPROVED_NOT_PAID", count: 0, total: 0 },
  PARTIALLY_PAID: { key: "PARTIALLY_PAID", count: 0, total: 0 },
  FULLY_PAID: { key: "FULLY_PAID", count: 0, total: 0 },
  OVERDUE: { key: "OVERDUE", count: 0, total: 0 },
});

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * Live payment position for the signed-in user's organisation.
 * Row visibility is enforced by the database, so this only ever
 * summarises what the person is allowed to see.
 */
export async function getPaymentBuckets(): Promise<PaymentBuckets> {
  const buckets = empty();

  const [queue, txns] = await Promise.all([
    supabase.rpc("get_approved_not_paid_queue"),
    supabase
      .from("transactions")
      .select("id, amount, amount_paid, status, approved_at, created_at"),
  ]);

  for (const row of (queue.data as any[]) ?? []) {
    buckets.APPROVED_NOT_PAID.count += 1;
    buckets.APPROVED_NOT_PAID.total += Number(row.amount_remaining ?? row.amount ?? 0);
  }

  const now = Date.now();
  for (const t of (txns.data as any[]) ?? []) {
    const amount = Number(t.amount ?? 0);
    const paid = Number(t.amount_paid ?? 0);
    const remaining = Math.max(amount - paid, 0);
    const fullyPaid = amount > 0 && paid >= amount;

    if (fullyPaid) {
      buckets.FULLY_PAID.count += 1;
      buckets.FULLY_PAID.total += amount;
      continue;
    }
    if (paid > 0) {
      buckets.PARTIALLY_PAID.count += 1;
      buckets.PARTIALLY_PAID.total += remaining;
    }
    const since = t.approved_at ?? t.created_at;
    if (since && now - new Date(since).getTime() > THIRTY_DAYS) {
      buckets.OVERDUE.count += 1;
      buckets.OVERDUE.total += remaining;
    }
  }

  return buckets;
}
