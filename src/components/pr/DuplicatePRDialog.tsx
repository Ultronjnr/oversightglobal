import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { DuplicateCandidate } from "@/services/pr-duplicate.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: DuplicateCandidate[];
  /** Label for the confirm button, e.g. "Submit anyway" or "Approve anyway". */
  confirmLabel?: string;
  onConfirm: () => void;
}

export function DuplicatePRDialog({
  open,
  onOpenChange,
  candidates,
  confirmLabel = "Submit anyway",
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Possible duplicate — please verify
          </AlertDialogTitle>
          <AlertDialogDescription>
            We found {candidates.length} similar requisition
            {candidates.length > 1 ? "s" : ""} raised in your organisation in the last 30 days.
            Check them before continuing so the same spend isn't captured twice.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 max-h-[280px] overflow-y-auto">
          {candidates.map((c) => (
            <div key={c.id} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs font-semibold">{c.transaction_id}</p>
                <span className="text-sm font-semibold">
                  {formatCurrency(c.total_amount, c.currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.requested_by_name} · {format(new Date(c.created_at), "dd MMM yyyy")} ·{" "}
                {c.status.replace(/_/g, " ").toLowerCase()}
              </p>
              {c.itemSummary && (
                <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{c.itemSummary}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {c.reasons.map((r) => (
                  <Badge key={r} variant="outline" className="text-[10px] py-0">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Review first</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
