import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Send, Loader2, Paperclip, Camera, X, FileText, ImageIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getPRMessages, sendPRMessage } from "@/services/pr-messaging.service";
import type { PRMessage, PRMessageAttachmentInput } from "@/types/pr-message.types";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CameraCaptureModal } from "@/components/capture/CameraCaptureModal";
import { PRChatAttachment } from "@/components/pr/PRChatAttachment";
import { analyzeDocument } from "@/services/ocr.service";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];
const MAX_FILE_MB = 15;
const MAX_ATTACHMENTS = 5;

const roleColors: Record<string, string> = {
  EMPLOYEE: "bg-primary/10 text-primary border-primary/20",
  HOD: "bg-warning/10 text-warning border-warning/20",
  FINANCE: "bg-success/10 text-success border-success/20",
  ADMIN: "bg-destructive/10 text-destructive border-destructive/20",
  SUPPLIER: "bg-muted text-muted-foreground border-border",
};

const POLL_INTERVAL_MS = 5000;
const FALLBACK_POLL_INTERVAL_MS = 15000;

interface PRChatPanelProps {
  prId: string;
  transactionId: string;
}

export function PRChatPanel({ prId, transactionId }: PRChatPanelProps) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const [messages, setMessages] = useState<PRMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<File[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);

  const scrollToBottom = () => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "auto" });
  };

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await getPRMessages(prId);
    if (result.success && result.data) {
      setMessages(result.data);
      setError(null);
    } else if (!silent) {
      setError(result.error || "Failed to load messages");
    }
    if (!silent) setLoading(false);
  }, [prId]);

  // Initial load
  useEffect(() => {
    fetchMessages(false);
  }, [fetchMessages]);

  // Polling — silent refresh every 5 s, stops on unmount
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchMessages(true);
    }, FALLBACK_POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMessages]);

  // Realtime subscription — instant updates for both participants
  useEffect(() => {
    const channel = supabase
      .channel(`pr_messages:${prId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pr_messages",
          filter: `pr_id=eq.${prId}`,
        },
        () => {
          // Re-fetch so attachments + role/name joins stay consistent
          fetchMessages(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prId, fetchMessages]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text && staged.length === 0) return;

    setSending(true);

    // 1. Upload staged files to pr-documents/chat/<prId>/...
    const uploaded: PRMessageAttachmentInput[] = [];
    const ocrPaths: { storage_path: string }[] = [];
    for (const f of staged) {
      const ext = f.name.split(".").pop() || "bin";
      const path = `chat/${prId}/${Date.now()}-${uuidv4()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("pr-documents")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) {
        toast.error(`Failed to upload ${f.name}`);
        setSending(false);
        return;
      }
      uploaded.push({ fileUrl: `pr-documents/${path}`, fileName: f.name });
      if (/^image\//.test(f.type) || /\.pdf$/i.test(f.name)) {
        ocrPaths.push({ storage_path: path });
      }
    }

    const result = await sendPRMessage({
      purchaseRequisitionId: prId,
      messageText: text || undefined,
      attachments: uploaded.length ? uploaded : undefined,
    });

    if (result.success && result.data) {
      // Dedupe: poll may have already fetched it
      setMessages((prev) =>
        prev.some((m) => m.id === result.data!.id) ? prev : [...prev, result.data!]
      );
      setNewMessage("");
      setStaged([]);
      // Refresh from server to ensure consistency with both participants
      fetchMessages(true);

      // Fire-and-forget OCR queueing for image/PDF attachments
      for (const o of ocrPaths) {
        void analyzeDocument({
          document_type: "PR_DOCUMENT",
          bucket: "pr-documents",
          storage_path: o.storage_path,
          pr_id: prId,
        }).catch(() => {
          /* swallow — OCR is best-effort, do not interrupt chat */
        });
      }
    } else {
      toast.error(result.error || "Failed to send message");
    }
    setSending(false);
  };

  const validateAndStage = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const next: File[] = [...staged];
    for (const f of arr) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`Max ${MAX_ATTACHMENTS} attachments per message`);
        break;
      }
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.error(`Unsupported file type: ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} exceeds ${MAX_FILE_MB}MB`);
        continue;
      }
      next.push(f);
    }
    setStaged(next);
  };

  const removeStaged = (idx: number) =>
    setStaged((s) => s.filter((_, i) => i !== idx));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center px-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchMessages(false)}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No messages yet. Start the conversation.
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.isSystemNote) {
                return (
                  <div key={msg.id} className="flex items-center gap-2 py-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground italic px-2 text-center">
                      {msg.messageText}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                );
              }

              const isMine = msg.senderUserId === currentUserId;

              return (
                <div
                  key={msg.id}
                  className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "flex flex-col gap-1 max-w-[78%]",
                      isMine ? "items-end" : "items-start"
                    )}
                  >
                    {!isMine && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="font-medium text-xs text-foreground">
                          {msg.senderName || "Unknown"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 ${roleColors[msg.senderRole] || ""}`}
                        >
                          {msg.senderRole}
                        </Badge>
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                        isMine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      )}
                    >
                      {msg.messageText && (
                        <p className="whitespace-pre-wrap break-words">{msg.messageText}</p>
                      )}
                      {msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {msg.attachments.map((att) => (
                            <PRChatAttachment
                              key={att.id}
                              fileUrl={att.fileUrl}
                              fileName={att.fileName}
                              mine={isMine}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-muted-foreground px-1">
                      {format(new Date(msg.createdAt), "dd MMM, HH:mm")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          {/* Scroll anchor */}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-border bg-muted/10 shrink-0">
        {staged.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {staged.map((f, i) => {
              const isImg = /^image\//.test(f.type);
              return (
                <div
                  key={`${f.name}-${i}`}
                  className="relative group flex items-center gap-1.5 rounded-md border border-border bg-background pl-2 pr-7 py-1 text-xs max-w-[200px]"
                >
                  {isImg ? (
                    <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                  <span className="truncate" title={f.name}>{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => removeStaged(i)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-1.5 items-end">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            hidden
            onChange={(e) => {
              if (e.target.files) validateAndStage(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={sending}
            onClick={() => setCameraOpen(true)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Take photo"
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder="Message… (Enter to send, Shift+Enter for new line)"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={2}
            className="flex-1 resize-none text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={sending || (!newMessage.trim() && staged.length === 0)}
            size="icon"
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          setCameraOpen(false);
          validateAndStage([file]);
        }}
        fileNamePrefix={`chat-${transactionId}`}
      />
    </div>
  );
}
