import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  getPRSourcingQuotes,
  type SourcedQuote,
} from "@/services/pr-sourcing.service";
import { getQuoteDocumentUrl } from "@/services/quote-document.service";
import { acceptQuote } from "@/services/finance.service";

interface Props {
  prId: string;
  /** Called after a winning quote has been recorded. */
  onSelected?: (quote: SourcedQuote) => void;
  /** Opens the approve/decline flow for the requisition. */
  onApprove?: (quote: SourcedQuote) => void;
  onDecline?: () => void;
}

/**
 * "Choose a supplier" panel shown to Finance/HOD on a pending requisition.
 * One quote can be selected; the lowest price is flagged but the decision
 * stays with the approver.
 */
export function QuoteChooser({ prId, onSelected, onApprove, onDecline }: Props) {
  const { format: formatCurrency } = useCurrency();
  const [quotes, setQuotes] = useState<SourcedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPRSourcingQuotes(prId);
    setQuotes(res.data);
    const accepted = res.data.find((q) => q.status === "ACCEPTED");
    if (accepted) {
      setSelectedId(accepted.id);
    } else {
      // Recommend the lowest live quote up front — Finance can change it.
      const live = res.data.filter((q) => q.status !== "REJECTED");
      if (live.length > 0) {
        setSelectedId(live.reduce((a, b) => (a.amount <= b.amount ? a : b)).id);
      }
    }
    setLoading(false);
  }, [prId]);

  useEffect(() => {
    load();
  }, [load]);

  const live = useMemo(
    () => quotes.filter((q) => q.status !== "REJECTED"),
    [quotes],
  );
  const lowestId = useMemo(() => {
    if (live.length === 0) return null;
    return live.reduce((a, b) => (a.amount <= b.amount ? a : b)).id;
  }, [live]);

  const accepted = quotes.find((q) => q.status === "ACCEPTED") || null;
  const selected = quotes.find((q) => q.id === selectedId) || null;


  const openDoc = async (q: SourcedQuote) => {
    if (!q.document_url) return;
    const res = await getQuoteDocumentUrl(q.document_url);
    if (res.success && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error || "Could not open document");
  };

  const handleApprove = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (!accepted) {
        const res = await acceptQuote(selected.id, prId);
        if (!res.success) {
          toast.error(res.error || "Could not select this quote");
          return;
        }
        await load();
        onSelected?.(selected);
      }
      onApprove?.(selected);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No supplier quotes were attached to this requisition.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-base font-semibold tracking-tight text-foreground">
          Choose a supplier
        </h4>
        <p className="text-xs text-muted-foreground">
          {accepted
            ? "A supplier has already been selected for this requisition."
            : "Every quote received is listed. The lowest is pre-selected — but you decide."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.map((q) => {
          const isSelected = selectedId === q.id;
          const rejected = q.status === "REJECTED";
          const isLowest = q.id === lowestId && !rejected;
          return (
            <button
              key={q.id}
              type="button"
              disabled={rejected || !!accepted}
              onClick={() => setSelectedId(q.id)}
              className={cn(
                "relative flex flex-col rounded-xl border p-4 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/30"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
                rejected && "opacity-50",
              )}
            >
              {isLowest && (
                <Badge className="absolute -top-2 right-3 h-5 px-2 text-[10px] font-semibold uppercase tracking-wide">
                  Lowest
                </Badge>
              )}

              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40",
                  )}
                >
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                  )}
                </span>
                <span className="text-sm font-semibold leading-tight text-foreground">
                  {q.display_supplier}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">
                {q.notes || q.delivery_time || "No additional detail supplied"}
              </p>

              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {formatCurrency(q.amount)}
              </p>

              <div className="mt-2 flex items-center gap-2 text-xs">
                {q.document_url ? (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDoc(q);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        openDoc(q);
                      }
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Paperclip className="h-3 w-3" /> quote attached
                  </span>
                ) : (
                  <span className="text-muted-foreground">no document</span>
                )}
                {q.status === "ACCEPTED" && (
                  <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
                    Selected
                  </Badge>
                )}
                {rejected && (
                  <Badge variant="secondary" className="text-[10px]">
                    Not selected
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-foreground px-4 py-3">
        <p className="text-sm text-background/90">
          {selected ? (
            <>
              {accepted ? "Approved" : "Approving"}{" "}
              <span className="font-semibold text-background">
                {selected.display_supplier}
              </span>{" "}
              at{" "}
              <span className="font-semibold tabular-nums text-background">
                {formatCurrency(selected.amount)}
              </span>
              {selected.id === lowestId ? " · lowest quote" : ""}
            </>
          ) : (
            "Select a supplier above to approve this requisition."
          )}
        </p>
        <div className="flex gap-2">
          {onDecline && (
            <Button size="sm" variant="destructive" onClick={onDecline}>
              Decline
            </Button>
          )}
          <Button size="sm" onClick={handleApprove} disabled={!selected || saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Approve selection
          </Button>
        </div>
      </div>
    </div>
  );
}

