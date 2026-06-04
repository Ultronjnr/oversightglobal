import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_transaction_id: string | null;
}

const typeAccent: Record<string, string> = {
  requisition_submitted: "bg-primary",
  requisition_approved: "bg-success",
  requisition_declined: "bg-destructive",
  reimbursement_submitted: "bg-primary",
  reimbursement_approved: "bg-success",
  partial_payment: "bg-warning",
  full_payment: "bg-success",
  batch_created: "bg-primary",
  overdue_transaction: "bg-destructive",
  invoice_uploaded: "bg-primary",
  ai_receipt_matched: "bg-primary",
};

// Maps a notification to the page it should open when clicked.
function getNotificationTarget(n: NotificationRow): string | null {
  switch (n.type) {
    case "reimbursement_submitted":
    case "reimbursement_approved":
    case "partial_payment":
    case "full_payment":
      return n.related_transaction_id
        ? `/expenses?highlight=${n.related_transaction_id}`
        : "/expenses";
    case "requisition_submitted":
    case "requisition_approved":
    case "requisition_declined":
      return n.related_transaction_id
        ? `/pr-history?highlight=${n.related_transaction_id}`
        : "/pr-history";
    case "batch_created":
    case "overdue_transaction":
    case "invoice_uploaded":
    case "ai_receipt_matched":
      return n.related_transaction_id
        ? `/expenses?highlight=${n.related_transaction_id}`
        : "/expenses";
    case "quote_request_received":
      return "/supplier/portal";
    case "quote_accepted":
    case "invoice_rejected":
      return "/supplier/portal";
    default:
      return null;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type, is_read, created_at, related_transaction_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as NotificationRow[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    load();
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const unread = items.filter((n) => !n.is_read).length;

  const markOne = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAll = async () => {
    if (!user?.id || unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
  };

  const handleClick = (n: NotificationRow) => {
    if (!n.is_read) markOne(n.id);
    const target = getNotificationTarget(n);
    if (target) {
      setOpen(false);
      navigate(target);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} className="h-8 text-xs gap-1">
              <Check className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {loading && items.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center px-6">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll see updates about your requisitions, payments and more here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 flex gap-3",
                    !n.is_read && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                      typeAccent[n.type] || "bg-muted-foreground",
                      n.is_read && "opacity-30",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug", !n.is_read ? "font-semibold" : "font-medium text-muted-foreground")}>
                        {n.title}
                      </p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize whitespace-nowrap">
                        {n.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}