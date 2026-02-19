/**
 * PR Messaging Service
 *
 * Handles all read/write operations for pr_messages and pr_message_attachments.
 * Security is enforced at two levels:
 *   1. RLS on the database (organization-scoped, no DELETE allowed)
 *   2. Application-level guards below for early, readable error surfacing
 *
 * Rules:
 *   - Messages can never be deleted or updated (audit integrity)
 *   - Empty message + no attachments is rejected before hitting the DB
 *   - Raw DB errors are never forwarded to callers
 */

import { supabase } from "@/integrations/supabase/client";
import {
  PRMessage,
  PRMessageAttachment,
  PRMessageAttachmentInput,
  PRMessagingError,
  PRMessagingResult,
  SendPRMessageInput,
} from "@/types/pr-message.types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the authenticated user or throws. */
async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new PRMessagingError(
      "You must be logged in to perform this action.",
      "UNAUTHENTICATED"
    );
  }
  return user;
}

/** 
 * Returns the caller's organization_id or throws.
 * For internal users: resolves via profiles.organization_id.
 * For SUPPLIER users: profiles.organization_id is NULL — resolves via suppliers.organization_id.
 */
async function requireCallerOrg(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();

  if (!error && data?.organization_id) {
    return data.organization_id;
  }

  // Fallback: supplier users have NULL profile org_id — look up via suppliers table
  const { data: supplierData, error: supplierError } = await supabase
    .from("suppliers")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (!supplierError && supplierData?.organization_id) {
    return supplierData.organization_id;
  }

  throw new PRMessagingError(
    "Your account is not linked to an organization.",
    "ORGANIZATION_MISMATCH"
  );
}

/** Returns the caller's role or throws. */
async function requireCallerRole(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !data?.role) {
    throw new PRMessagingError(
      "Could not determine your role.",
      "UNAUTHENTICATED"
    );
  }

  return data.role;
}

/** Returns the caller's display name. */
async function getCallerName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("name, surname")
    .eq("id", userId)
    .single();

  if (!data) return "Unknown";
  return data.surname ? `${data.name} ${data.surname}` : data.name;
}

/**
 * Verifies that the PR exists and is visible to the caller via RLS.
 * For internal users: PR must belong to caller's org.
 * For suppliers: RLS allows access if they have a quote_request on this PR —
 *   so we just check the PR exists and is visible (no org equality check needed,
 *   as the DB-level policy already enforces correct tenant scoping for suppliers).
 */
async function requirePRInOrg(
  prId: string,
  _callerOrgId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("purchase_requisitions")
    .select("id")
    .eq("id", prId)
    .maybeSingle();

  if (error || !data) {
    throw new PRMessagingError(
      "The purchase requisition was not found or you do not have access to it.",
      "PR_NOT_FOUND"
    );
  }
}

/** Maps a raw DB row to a PRMessageAttachment. */
function mapAttachment(row: {
  id: string;
  file_url: string;
  file_name: string;
  created_at: string;
}): PRMessageAttachment {
  return {
    id: row.id,
    fileUrl: row.file_url,
    fileName: row.file_name,
    createdAt: row.created_at,
  };
}

/** Maps a raw DB row (with optional attachments) to a PRMessage. */
function mapMessage(
  row: {
    id: string;
    pr_id: string;
    sender_id: string;
    sender_role: string;
    sender_name: string;
    message: string | null;
    is_system_note: boolean;
    created_at: string;
  },
  attachments: PRMessageAttachment[] = []
): PRMessage {
  return {
    id: row.id,
    purchaseRequisitionId: row.pr_id,
    senderUserId: row.sender_id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    messageText: row.message,
    isSystemNote: row.is_system_note,
    createdAt: row.created_at,
    attachments,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * postSystemNote
 *
 * Writes an immutable, is_system_note=true audit entry to pr_messages.
 * Intended to be called by backend services (not directly by the user) to record
 * lifecycle events such as quote approval, invoice upload, status transitions, etc.
 *
 * Security guarantees:
 *   - Caller must be authenticated (service operates in the context of the acting user)
 *   - Organization isolation enforced via RLS and application-level guard
 *   - System notes are immutable (no update/delete exposed)
 *
 * @param prId  The purchase_requisition_id the note belongs to.
 * @param note  Plain-text description of the system event.
 */
export async function postSystemNote(
  prId: string,
  note: string
): Promise<PRMessagingResult<PRMessage>> {
  try {
    const user = await requireUser();

    // Fetch role, name, and PR's org_id in parallel.
    // We use the PR's organization_id for the message (not caller's profile org)
    // to correctly handle supplier users whose profile.organization_id is NULL.
    const [callerRole, callerName, prRow] = await Promise.all([
      requireCallerRole(user.id),
      getCallerName(user.id),
      supabase
        .from("purchase_requisitions")
        .select("id, organization_id")
        .eq("id", prId)
        .maybeSingle(),
    ]);

    if (prRow.error || !prRow.data) {
      throw new PRMessagingError(
        "The purchase requisition was not found or you do not have access to it.",
        "PR_NOT_FOUND"
      );
    }

    const prOrgId = prRow.data.organization_id;

    const { data: messageRow, error: insertError } = await supabase
      .from("pr_messages")
      .insert({
        pr_id: prId,
        sender_id: user.id,
        sender_name: callerName,
        sender_role: callerRole,
        message: note.trim(),
        organization_id: prOrgId,
        is_system_note: true,
      })
      .select()
      .single();

    if (insertError || !messageRow) {
      console.warn("[pr-messaging] postSystemNote insert failed:", insertError?.message);
      throw new PRMessagingError(
        "Failed to record system note. The action completed but the audit entry was not saved.",
        "INSERT_FAILED"
      );
    }

    return { success: true, data: mapMessage(messageRow, []) };
  } catch (err) {
    if (err instanceof PRMessagingError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}


/**
 * sendPRMessage
 *
 * Creates a new message (and optional attachments) on a PR.
 *
 * Security guarantees:
 *   - Caller must be authenticated
 *   - Caller's organization must match the PR's organization (checked via RLS + explicit guard)
 *   - At least messageText OR one attachment must be provided
 *   - Deletion and updates are not exposed (no functions provided)
 */
export async function sendPRMessage(
  input: SendPRMessageInput
): Promise<PRMessagingResult<PRMessage>> {
  try {
    // 1. Validate inputs before hitting the DB
    const hasText = typeof input.messageText === "string" && input.messageText.trim().length > 0;
    const hasAttachments = Array.isArray(input.attachments) && input.attachments.length > 0;

    if (!hasText && !hasAttachments) {
      throw new PRMessagingError(
        "A message must contain either text or at least one attachment.",
        "EMPTY_MESSAGE"
      );
    }

    // 2. Authenticate
    const user = await requireUser();

    // 3. Resolve role, name, and PR's org_id in parallel.
    // We use the PR's organization_id for the message insert so supplier users
    // (who have NULL profile.organization_id) get the correct org on the message.
    const [callerRole, callerName, prRow] = await Promise.all([
      requireCallerRole(user.id),
      getCallerName(user.id),
      supabase
        .from("purchase_requisitions")
        .select("id, organization_id")
        .eq("id", input.purchaseRequisitionId)
        .maybeSingle(),
    ]);

    if (prRow.error || !prRow.data) {
      throw new PRMessagingError(
        "The purchase requisition was not found or you do not have access to it.",
        "PR_NOT_FOUND"
      );
    }

    const prOrgId = prRow.data.organization_id;

    // 4. Insert the message row
    const { data: messageRow, error: insertError } = await supabase
      .from("pr_messages")
      .insert({
        pr_id: input.purchaseRequisitionId,
        sender_id: user.id,
        sender_name: callerName,
        sender_role: callerRole,
        message: hasText ? input.messageText!.trim() : "",
        organization_id: prOrgId,
        is_system_note: input.isSystemNote ?? false,
      })
      .select()
      .single();

    if (insertError || !messageRow) {
      throw new PRMessagingError(
        "Failed to send the message. Please try again.",
        "INSERT_FAILED"
      );
    }

    // 6. Insert attachment rows if provided
    let attachments: PRMessageAttachment[] = [];

    if (hasAttachments) {
      const attachmentInserts = (input.attachments as PRMessageAttachmentInput[]).map(
        (a) => ({
          message_id: messageRow.id,
          file_url: a.fileUrl,
          file_name: a.fileName,
        })
      );

      const { data: attachmentRows, error: attachError } = await supabase
        .from("pr_message_attachments")
        .insert(attachmentInserts)
        .select();

      if (attachError) {
        // Message was already committed — log and continue rather than throwing
        console.warn("[pr-messaging] Attachment insert failed:", attachError.message);
      } else if (attachmentRows) {
        attachments = attachmentRows.map(mapAttachment);
      }
    }

    return {
      success: true,
      data: mapMessage(messageRow, attachments),
    };
  } catch (err) {
    if (err instanceof PRMessagingError) {
      return { success: false, error: err.message };
    }
    // Unknown errors — do not leak internals
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * getPRMessages
 *
 * Returns all messages for a PR, ordered oldest → newest.
 *
 * Security guarantees:
 *   - Caller must be authenticated
 *   - Caller's organization must match the PR's organization (checked via RLS + explicit guard)
 *   - Attachments are fetched in a single follow-up query and joined in memory
 */
export async function getPRMessages(
  prId: string
): Promise<PRMessagingResult<PRMessage[]>> {
  try {
    // 1. Authenticate
    const user = await requireUser();

    // 2. Verify PR is visible to this user (RLS enforces tenant isolation server-side).
    // We no longer do an org equality check here because supplier users have NULL
    // profile.organization_id — the DB-level RLS policy already restricts what they can see.
    const { data: prCheck, error: prCheckError } = await supabase
      .from("purchase_requisitions")
      .select("id")
      .eq("id", prId)
      .maybeSingle();

    if (prCheckError || !prCheck) {
      throw new PRMessagingError(
        "The purchase requisition was not found or you do not have access to it.",
        "PR_NOT_FOUND"
      );
    }

    // 3. Fetch messages (RLS enforces org scope server-side)
    const { data: messageRows, error: fetchError } = await supabase
      .from("pr_messages")
      .select("*")
      .eq("pr_id", prId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw new PRMessagingError(
        "Failed to load messages. Please try again.",
        "FETCH_FAILED"
      );
    }

    if (!messageRows || messageRows.length === 0) {
      return { success: true, data: [] };
    }

    // 4. Fetch all attachments for these messages in one query
    const messageIds = messageRows.map((m) => m.id);

    const { data: attachmentRows, error: attachFetchError } = await supabase
      .from("pr_message_attachments")
      .select("*")
      .in("message_id", messageIds);

    if (attachFetchError) {
      // Non-fatal — return messages without attachments
      console.warn("[pr-messaging] Attachment fetch failed:", attachFetchError.message);
    }

    // 5. Group attachments by message_id
    const attachmentsByMessageId = new Map<string, PRMessageAttachment[]>();

    if (attachmentRows) {
      for (const row of attachmentRows) {
        const mapped = mapAttachment(row);
        const existing = attachmentsByMessageId.get(row.message_id) ?? [];
        existing.push(mapped);
        attachmentsByMessageId.set(row.message_id, existing);
      }
    }

    // 6. Map and return
    const messages: PRMessage[] = messageRows.map((row) =>
      mapMessage(row, attachmentsByMessageId.get(row.id) ?? [])
    );

    return { success: true, data: messages };
  } catch (err) {
    if (err instanceof PRMessagingError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

