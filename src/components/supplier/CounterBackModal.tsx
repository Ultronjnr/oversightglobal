import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Handshake, Send } from "lucide-react";
import { toast } from "sonner";
import { counterBackQuote, type SupplierQuote } from "@/services/supplier.service";
import { formatCurrency } from "@/lib/utils";

interface CounterBackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: SupplierQuote | null;
  currency?: string;
  onSuccess: () => void;
}

export function CounterBackModal({ open, onOpenChange, quote, currency = "ZAR", onSuccess }: CounterBackModalProps) {
  const [itemPrices, setItemPrices] = useState<Array<{ description: string; quantity: number; unit_price: number; total: number }>>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill from the supplier's last item prices (their previous quote)
  useEffect(() => {
    if (!quote) {
      setItemPrices([]);
      setNotes("");
      return;
    }
    const src = quote.item_prices && quote.item_prices.length > 0 ? quote.item_prices : [];
    setItemPrices(
      src.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        total: Number(((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)).toFixed(2)),
      }))
    );
    setNotes("");
  }, [quote?.id]);

  const revisedTotal = useMemo(
    () => itemPrices.reduce((sum, it) => sum + (it.total || 0), 0),
    [itemPrices]
  );

  const handleItemPriceChange = (idx: number, unitPrice: number) => {
    setItemPrices((prev) => {
      const next = [...prev];
      const qty = Number(next[idx].quantity) || 0;
      const safe = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
      next[idx] = { ...next[idx], unit_price: safe, total: Number((qty * safe).toFixed(2)) };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!quote) return;
    const total = itemPrices.length > 0 ? revisedTotal : quote.amount;
    if (!(total > 0)) {
      toast.error("Enter valid per-item prices");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await counterBackQuote({
        quoteId: quote.id,
        amount: total,
        itemPrices: itemPrices.length > 0 ? itemPrices : undefined,
        notes: notes || undefined,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to send counter");
        return;
      }
      toast.success("Counter sent back to Finance");
      onSuccess();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const financeCounter = Number(quote?.counter_offer_amount) || 0;
  const previousAmount = Number(quote?.amount) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Counter Back to Finance
          </DialogTitle>
          <DialogDescription>
            Propose a revised per-item price. Your quote will return to Finance for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context: your last quote vs Finance's counter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3 bg-muted/40">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Your last quote</p>
              <p className="text-lg font-mono font-semibold">{formatCurrency(previousAmount, currency)}</p>
            </div>
            <div className="rounded-md border border-warning/40 p-3 bg-warning/5">
              <p className="text-[10px] uppercase tracking-wide text-warning">Finance's counter</p>
              <p className="text-lg font-mono font-semibold text-warning">{formatCurrency(financeCounter, currency)}</p>
            </div>
          </div>

          {quote?.counter_offer_notes && (
            <div className="bg-muted/50 rounded-md p-3">
              <p className="text-xs font-medium mb-1">Note from Finance</p>
              <p className="text-sm text-muted-foreground italic">"{quote.counter_offer_notes}"</p>
            </div>
          )}

          {/* Per-item editor */}
          {itemPrices.length > 0 ? (
            <div className="bg-muted/40 rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-12 gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                <div className="col-span-6">Item / Qty</div>
                <div className="col-span-6 text-right">Your revised Price / unit</div>
              </div>
              {itemPrices.map((it, idx) => {
                const qty = Number(it.quantity) || 0;
                const lineTotal = qty * (Number(it.unit_price) || 0);
                return (
                  <div key={idx} className="bg-background/60 rounded-md p-2 border border-border/40 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6 text-xs">
                        <p className="font-medium truncate">{it.description}</p>
                        <p className="text-muted-foreground">Qty: {qty}</p>
                      </div>
                      <div className="col-span-6">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unit_price === 0 ? "" : it.unit_price}
                          onChange={(e) => handleItemPriceChange(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="h-8 text-sm text-right"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-border/40 pt-1.5">
                      <span className="text-muted-foreground">
                        Line total = {qty} × {formatCurrency(Number(it.unit_price) || 0, currency)}
                      </span>
                      <span className="font-mono font-semibold">{formatCurrency(lineTotal, currency)}</span>
                    </div>
                  </div>
                );
              })}
              <div className="border-t pt-2 flex justify-between text-sm">
                <span className="font-medium">Your Revised Total</span>
                <span className="font-mono font-semibold text-primary">{formatCurrency(revisedTotal, currency)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No per-item breakdown on your original quote — your top-line amount will be updated on submit.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="counter-back-notes">Message to Finance (optional)</Label>
            <Textarea
              id="counter-back-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Explain your revised pricing..."
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Counter to Finance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}