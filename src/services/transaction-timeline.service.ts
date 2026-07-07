import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

export interface TimelineEvent {
  id: string;
  organization_id: string;
  pr_id: string | null;
  transaction_id: string | null;
  event_type: string;
  title: string;
  comment: string | null;
  status: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  created_at: string;
}

export interface TimelineResult {
  success: boolean;
  data: TimelineEvent[];
  error?: string;
}

/**
 * Fetch the full, chronological timeline for a transaction. Events are keyed
 * by the purchase requisition so the feed spans the entire lifecycle
 * (Created -> Approved -> Quote -> Invoice -> Payment) even for events that
 * predate the transaction row itself.
 */
export async function getTransactionTimeline(params: {
  prId?: string | null;
  transactionId?: string | null;
}): Promise<TimelineResult> {
  try {
    const { prId, transactionId } = params;
    if (!prId && !transactionId) {
      return { success: false, data: [], error: "No transaction reference provided" };
    }

    let query = supabase
      .from("transaction_events")
      .select("*")
      .order("created_at", { ascending: true });

    if (prId) {
      query = query.eq("pr_id", prId);
    } else if (transactionId) {
      query = query.eq("transaction_id", transactionId);
    }

    const { data, error } = await query;
    if (error) {
      logError("getTransactionTimeline", error);
      return { success: false, data: [], error: getSafeErrorMessage(error) };
    }
    return { success: true, data: (data || []) as TimelineEvent[] };
  } catch (e) {
    logError("getTransactionTimeline", e);
    return { success: false, data: [], error: getSafeErrorMessage(e) };
  }
}
