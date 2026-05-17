import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface BatchPaymentItem {
  /** Discriminator. Defaults to "invoice" for backward compatibility. */
  kind?: "invoice" | "reimbursement";
  /** Invoice id (when kind === "invoice"). */
  invoiceId?: string;
  /** Reimbursement id (when kind === "reimbursement"). */
  reimbursementId?: string;
  party: string;
  partySub?: string;
  totalAmount: number;
  amountPaid: number;
  remaining: number;
  currency?: string;
}

interface BatchPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BatchPaymentItem[];
  onConfirmed: () => void;
}

export function BatchPaymentModal({ open, onOpenChange, items, onConfirmed }: BatchPaymentModalProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const keyOf = (it: BatchPaymentItem) =>
    (it.kind === "reimbursement" ? `r:${it.reimbursementId}` : `i:${it.invoiceId}`) as string;

  // Initialize amounts when items change / modal opens.
  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      items.forEach((it) => {
        init[keyOf(it)] = it.remaining.toFixed(2);
      });
      setAmounts(init);
      setNotes("");
    }
  }, [open, items]);

  const parsed = items.map((it) => {
    const raw = amounts[keyOf(it)] ?? "0";
    const num = Number(raw);
    const valid = !isNaN(num) && num >= 0 && num <= it.remaining;
    return { item: it, amount: isNaN(num) ? 0 : num, valid };
  });

  const totalBatch = parsed.reduce((s, p) => s + p.amount, 0);
  const hasInvalid = parsed.some((p) => !p.valid);
  const hasPositive = parsed.some((p) => p.amount > 0);

  const handleAmountChange = (id: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const handleConfirm = async () => {
    if (hasInvalid) {
      toast.error("Some amounts exceed the remaining balance.");
      return;
    }
    if (!hasPositive) {
      toast.error("Enter at least one payment amount.");
      return;
    }
    setSubmitting(true);
    const allocations = parsed
      .filter((p) => p.amount > 0)
      .map((p) =>
        p.item.kind === "reimbursement"
          ? { reimbursement_id: p.item.reimbursementId!, amount: p.amount }
          : { invoice_id: p.item.invoiceId!, amount: p.amount },
      );

    const { data, error } = await supabase.rpc("create_payment_batch_draft", {
      _allocations: allocations as any,
      _notes: notes || null,
    });

    setSubmitting(false);

    if (error) {
      toast.error("Failed to create batch", { description: error.message });
      return;
    }
    const result = data as any;
    if (!result?.success) {
      toast.error("Failed to create batch", { description: result?.error || "Unknown error" });
      return;
    }

    toast.success("Draft batch created", {
      description: `Batch ${result.batch_number || ""} — confirm it as paid from the Batches tab.`,
    });
    onOpenChange(false);
    onConfirmed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Create Payment Batch
          </DialogTitle>
          <DialogDescription>
            Review the selected transactions and set the amount to pay now for each. Amounts default to
            the full remaining balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {items.map((it) => {
            const k = keyOf(it);
            const p = parsed.find((x) => keyOf(x.item) === k)!;
            return (
              <div
                key={k}
                className="rounded-lg border border-border/50 p-3 bg-muted/10"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{it.party}</p>
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                          it.kind === "reimbursement"
                            ? "bg-warning/10 text-warning border-warning/30"
                            : "bg-primary/10 text-primary border-primary/30"
                        }`}
                      >
                        {it.kind === "reimbursement" ? "Reimbursement" : "Invoice"}
                      </span>
                    </div>
                    {it.partySub && (
                      <p className="text-xs text-muted-foreground">{it.partySub}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold">{formatCurrency(it.totalAmount, it.currency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Already Paid</p>
                    <p className="font-semibold">{formatCurrency(it.amountPaid, it.currency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="font-semibold text-warning">
                      {formatCurrency(it.remaining, it.currency)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    Amount to Pay Now
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={it.remaining}
                    step="0.01"
                    value={amounts[k] ?? ""}
                    onChange={(e) => handleAmountChange(k, e.target.value)}
                    className={`h-8 ${!p.valid ? "border-destructive" : ""}`}
                  />
                </div>
                {!p.valid && (
                  <p className="text-xs text-destructive mt-1">
                    Cannot exceed remaining balance.
                  </p>
                )}
              </div>
            );
          })}

          <div>
            <label className="text-xs text-muted-foreground">Batch notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference, payment method, etc."
              maxLength={500}
              rows={2}
            />
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
            <span className="text-sm font-medium">Total Batch Payment Amount</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(totalBatch)}</span>
          </div>

          {hasInvalid && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">
                One or more amounts exceed the remaining balance. Please correct before confirming.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || hasInvalid || !hasPositive} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirm Batch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}