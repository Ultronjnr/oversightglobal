import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  getProcurementTrail,
  recordInvoiceForSelectedQuote,
  type ProcurementTrail,
} from "@/services/procurement-trail.service";

interface Props {
  prId: string;
  /** Allows recording the actual invoice received from the selected supplier. */
  canRecordInvoice?: boolean;
  onChanged?: () => void;
}

/**
 * Procurement record for one requisition:
 * Transaction → Invoice → Requisition → Selected quote → Selected supplier →
 * Other quotes received. Also the place where the actual invoice is recorded
 * in a one-person organisation.
 */
export function ProcurementTrailPanel({ prId, canRecordInvoice = false, onChanged }: Props) {
  const { format: formatCurrency } = useCurrency();
  const [trail, setTrail] = useState<ProcurementTrail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getProcurementTrail(prId);
    setTrail(res.data ?? null);
    setLoading(false);
  }, [prId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    if (!trail?.selected) return;
    setUploading(true);
    setMismatch(null);
    const res = await recordInvoiceForSelectedQuote(file, prId, trail.selected.id);
    setUploading(false);
    if (!res.success) {
      toast.error(res.error || "Could not record the invoice");
      return;
    }
    if (res.supplierMismatch) {
      setMismatch(
        `The invoice appears to be from "${res.scannedSupplier}" but the selected supplier is "${res.selectedSupplier}". The invoice was saved against the selected supplier — please check it.`,
      );
      toast.warning("Invoice recorded, but the supplier does not match the selected quote.");
    } else {
      toast.success("Invoice recorded and matched to the selected quote.");
    }
    await load();
    onChanged?.();
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading procurement record…
      </p>
    );
  }
  if (!trail) return null;

  const { selected, alternatives, invoice, transaction, awaitingInvoice } = trail;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Procurement record</h4>

      {selected ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="text-[10px] uppercase">Selected supplier</Badge>
            <span className="font-semibold text-foreground">{selected.supplier_name}</span>
            {selected.quote_number && (
              <span className="text-xs text-muted-foreground">
                Quote #{selected.quote_number}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(selected.amount)}
            {selected.vat_amount > 0 && ` · VAT ${formatCurrency(selected.vat_amount)}`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No quote has been selected yet — choose the winning quote to continue.
        </p>
      )}

      {selected && (
        <div className="rounded-lg border p-4 space-y-3">
          {invoice ? (
            <p className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Invoice recorded on {format(new Date(invoice.created_at), "dd MMM yyyy")} ·{" "}
              {invoice.status}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="h-4 w-4 text-amber-500" />
              Awaiting invoice from {selected.supplier_name}
            </p>
          )}

          {awaitingInvoice && canRecordInvoice && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload actual invoice
              </Button>
            </>
          )}

          {mismatch && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {mismatch}
            </p>
          )}
        </div>
      )}

      {alternatives.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Other quotes received ({alternatives.length})
          </p>
          {alternatives.map((q) => (
            <div
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="text-foreground">
                {q.supplier_name}
                {q.quote_number ? ` · Quote #${q.quote_number}` : ""}
              </span>
              <span className="text-muted-foreground">{formatCurrency(q.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {transaction && (
        <p className="text-xs text-muted-foreground">
          Payment record: {transaction.status.split("_").join(" ").toLowerCase()}
          {transaction.payment_reference ? ` · reference ${transaction.payment_reference}` : ""}
        </p>
      )}
    </div>
  );
}
