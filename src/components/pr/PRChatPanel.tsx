import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Send, Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getPRMessages, sendPRMessage, type PRMessage } from "@/services/pr-chat.service";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  EMPLOYEE: "bg-primary/10 text-primary border-primary/20",
  HOD: "bg-warning/10 text-warning border-warning/20",
  FINANCE: "bg-success/10 text-success border-success/20",
  ADMIN: "bg-destructive/10 text-destructive border-destructive/20",
};

interface PRChatPanelProps {
  prId: string;
  transactionId: string;
}

export function PRChatPanel({ prId, transactionId }: PRChatPanelProps) {
  const [messages, setMessages] = useState<PRMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const result = await getPRMessages(prId);
    if (result.success && result.data) {
      setMessages(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [prId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    const result = await sendPRMessage({ pr_id: prId, message: newMessage });
    
    if (result.success && result.data) {
      setMessages((prev) => [...prev, result.data!]);
      setNewMessage("");
    } else {
      toast.error(result.error || "Failed to send message");
    }
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="border border-border/30 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Transaction Chat</span>
        <span className="text-xs text-muted-foreground">({transactionId})</span>
      </div>

      {/* Messages */}
      <ScrollArea className="h-64" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No messages yet. Start the conversation.
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">
                    {msg.sender_name}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs py-0 ${roleColors[msg.sender_role] || ""}`}
                  >
                    {msg.sender_role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.created_at), "dd MMM yyyy, HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 pl-0">{msg.message}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border/30 bg-muted/10">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sending}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={sending || !newMessage.trim()}
            size="icon"
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
