import { useEffect, useState } from "react";
import { format } from "date-fns";
import {Loader2, FilePlus2, CheckCircle2, FileText, ThumbsUp, Receipt, Wallet, Layers, Clock, Circle, XCircle} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getTransactionTimeline,
  type TimelineEvent,
} from "@/services/transaction-timeline.service";

interface TransactionTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prId?: string | null;
  transactionId?: string | null;
  reference?: string;
}

function eventIcon(type: string) {
  const t = type.toUpperCase();
  if (t === "CREATED") return FilePlus2;
  if (t === "FINANCE_APPROVED") return CheckCircle2;
  if (t.startsWith("QUOTE")) return t.includes("ACCEPTED") ? ThumbsUp : FileText;
  if (t.startsWith("INVOICE")) return t.includes("PAID") ? Wallet : Receipt;
  if (t === "BATCH_CREATED") return Layers;
  if (t === "TXN_PAID") return Wallet;
  if (t === "TXN_PARTIAL") return Wallet;
  if (t.includes("REJECT")) return XCircle;
  if (t.includes("CLOSED") || t.includes("FULFILLED")) return CheckCircle2;
  return Circle;
}

function accent(type: string): string {
  const t = type.toUpperCase();
  if (t === "TXN_PAID" || t === "INVOICE_PAID" || t === "FINANCE_APPROVED" || t === "QUOTE_ACCEPTED")
    return "text-success border-success/40 bg-success/10";
  if (t.includes("REJECT")) return "text-destructive border-destructive/40 bg-destructive/10";
  if (t === "TXN_PARTIAL" || t === "INVOICE_PARTIAL") return "text-warning border-warning/40 bg-warning/10";
  return "text-primary border-primary/30 bg-primary/10";
}

export function TransactionTimelineDialog({
  open,
  onOpenChange,
  prId,
  transactionId,
  reference,
}: TransactionTimelineDialogProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getTransactionTimeline({ prId, transactionId }).then((res) => {
      if (cancelled) return;
      setEvents(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, prId, transactionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Transaction Timeline
          </DialogTitle>
          <DialogDescription>
            {reference ? `Full activity history for ${reference}` : "Full activity history"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-12 w-12" />}
            title="No activity yet"
            description="Timeline events will appear here as this transaction progresses."
          />
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <ol className="relative ml-3 border-l border-border">
              {events.map((ev) => {
                const Icon = eventIcon(ev.event_type);
                const dt = new Date(ev.created_at);
                return (
                  <li key={ev.id} className="mb-6 ml-6">
                    <span
                      className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border ${accent(
                        ev.event_type,
                      )}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <h4 className="font-semibold text-sm">{ev.title}</h4>
                      <time className="text-xs text-muted-foreground">
                        {format(dt, "dd MMM yyyy")} · {format(dt, "HH:mm")}
                      </time>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{ev.actor_name || "System"}</span>
                      {ev.actor_role && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {ev.actor_role}
                        </Badge>
                      )}
                    </div>
                    {ev.comment && (
                      <p className="mt-1 text-xs text-foreground/80">{ev.comment}</p>
                    )}
                    {ev.old_value && ev.new_value && ev.old_value !== ev.new_value && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <span className="line-through">{ev.old_value}</span>
                        {" → "}
                        <span className="text-foreground">{ev.new_value}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
