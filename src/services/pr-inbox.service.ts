/**
 * PR Inbox Service (Layer 5)
 *
 * Aggregates every requisition conversation the caller can see into a single
 * inbox. Visibility is entirely RLS-driven: the query below returns only the
 * messages the caller's role and organization are allowed to read, so suppliers
 * see just their own threads and internal staff see their organization's.
 *
 * Read state is stored per user in localStorage (last-opened timestamp per
 * thread) — no schema change, and unread counts stay accurate on the device the
 * user works from.
 */

import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

const READ_STATE_KEY = "ovasyt.inbox.lastRead";
/** Upper bound on messages pulled per inbox refresh. */
const MESSAGE_WINDOW = 600;

export interface InboxThread {
  prId: string;
  transactionId: string;
  status: string;
  requestedByName: string | null;
  totalAmount: number;
  /** Preview of the newest message on the thread. */
  lastMessage: string;
  lastSenderName: string;
  lastMessageAt: string;
  isLastSystemNote: boolean;
  messageCount: number;
  unreadCount: number;
}

type ReadState = Record<string, string>;

function loadReadState(): ReadState {
  try {
    const raw = localStorage.getItem(READ_STATE_KEY);
    return raw ? (JSON.parse(raw) as ReadState) : {};
  } catch {
    return {};
  }
}

/** Marks a thread as read up to now. */
export function markThreadRead(prId: string): void {
  try {
    const state = loadReadState();
    state[prId] = new Date().toISOString();
    localStorage.setItem(READ_STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — unread counts simply stay as they are */
  }
}

/**
 * Every conversation visible to the caller, newest activity first.
 * Messages the caller sent themselves never count as unread.
 */
export async function getInboxThreads(): Promise<{
  success: boolean;
  data: InboxThread[];
  error?: string;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, data: [], error: "Not authenticated" };

    const { data, error } = await supabase
      .from("pr_messages")
      .select(
        "id, pr_id, message, sender_id, sender_name, is_system_note, created_at, pr:purchase_requisitions(id, transaction_id, status, requested_by_name, total_amount)"
      )
      .order("created_at", { ascending: false })
      .limit(MESSAGE_WINDOW);

    if (error) {
      logError("getInboxThreads", error);
      return { success: false, data: [], error: getSafeErrorMessage(error) };
    }

    const readState = loadReadState();
    const threads = new Map<string, InboxThread>();

    for (const row of (data as any[]) || []) {
      const pr = row.pr;
      if (!pr) continue; // PR not visible to this caller

      const lastRead = readState[row.pr_id];
      const isUnread =
        row.sender_id !== user.id &&
        (!lastRead || new Date(row.created_at) > new Date(lastRead));

      const existing = threads.get(row.pr_id);
      if (existing) {
        existing.messageCount += 1;
        if (isUnread) existing.unreadCount += 1;
        continue;
      }

      threads.set(row.pr_id, {
        prId: row.pr_id,
        transactionId: pr.transaction_id,
        status: pr.status,
        requestedByName: pr.requested_by_name ?? null,
        totalAmount: Number(pr.total_amount) || 0,
        lastMessage: (row.message || "").trim() || "Attachment",
        lastSenderName: row.sender_name || "Unknown",
        lastMessageAt: row.created_at,
        isLastSystemNote: !!row.is_system_note,
        messageCount: 1,
        unreadCount: isUnread ? 1 : 0,
      });
    }

    return {
      success: true,
      data: [...threads.values()].sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      ),
    };
  } catch (error) {
    logError("getInboxThreads", error);
    return { success: false, data: [], error: getSafeErrorMessage(error) };
  }
}

/** Total unread messages across all visible threads (for nav badges). */
export async function getUnreadMessageCount(): Promise<number> {
  const result = await getInboxThreads();
  if (!result.success) return 0;
  return result.data.reduce((sum, t) => sum + t.unreadCount, 0);
}
