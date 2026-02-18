// PR Messaging Types

export interface PRMessageAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
}

export interface PRMessage {
  id: string;
  purchaseRequisitionId: string;
  senderUserId: string;
  senderRole: string;
  messageText: string | null;
  isSystemNote: boolean;
  createdAt: string;
  attachments: PRMessageAttachment[];
  // Joined sender profile info
  senderName?: string;
}

// Input types

export interface PRMessageAttachmentInput {
  fileUrl: string;
  fileName: string;
}

export interface SendPRMessageInput {
  purchaseRequisitionId: string;
  /** Optional when at least one attachment is provided */
  messageText?: string;
  /** Optional when messageText is provided */
  attachments?: PRMessageAttachmentInput[];
  /** Internal flag — set by server-side logic only, not by callers */
  isSystemNote?: boolean;
}

// Typed error

export class PRMessagingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "EMPTY_MESSAGE"
      | "ORGANIZATION_MISMATCH"
      | "PR_NOT_FOUND"
      | "INSERT_FAILED"
      | "FETCH_FAILED"
      | "UNAUTHENTICATED"
  ) {
    super(message);
    this.name = "PRMessagingError";
  }
}

// Service response wrapper

export interface PRMessagingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
