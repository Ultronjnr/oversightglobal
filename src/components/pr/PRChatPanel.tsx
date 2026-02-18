import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Send, Loader2, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getPRMessages, sendPRMessage } from "@/services/pr-messaging.service";
import type { PRMessage } from "@/types/pr-message.types";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  EMPLOYEE: "bg-primary/10 text-primary border-primary/20",
  HOD: "bg-warning/10 text-warning border-warning/20",
  FINANCE: "bg-success/10 text-success border-success/20",
  ADMIN: "bg-destructive/10 text-destructive border-destructive/20",
  SUPPLIER: "bg-muted text-muted-foreground border-border",
};

const POLL_INTERVAL_MS = 5000;

interface PRChatPanelProps {
  prId: string;
  transactionId: string;
}

export function PRChatPanel({ prId, transactionId }: PRChatPanelProps) {
  const [messages, setMessages] = useState<PRMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMessages]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;

    setSending(true);
    const result = await sendPRMessage({
      purchaseRequisitionId: prId,
      messageText: text,
    });

    if (result.success && result.data) {
      setMessages((prev) => [...prev, result.data!]);
      setNewMessage("");
    } else {
      toast.error(result.error || "Failed to send message");
    }
    setSending(false);
  };

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
            messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                {msg.isSystemNote ? (
                  // System note — subtle centered divider style
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground italic px-2">
                      {msg.messageText}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {msg.senderName || "Unknown"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs py-0 ${roleColors[msg.senderRole] || ""}`}
                      >
                        {msg.senderRole}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.createdAt), "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    {msg.messageText && (
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {msg.messageText}
                      </p>
                    )}
                    {msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {msg.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline bg-primary/5 border border-primary/20 rounded px-2 py-1"
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.fileName}
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
          {/* Scroll anchor */}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-border bg-muted/10 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={2}
            className="flex-1 resize-none text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
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
    </div>
  );
}
