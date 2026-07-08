import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  submitBatchToNetcash, pollNetcashStatus, retryNetcashPayment,
  listNetcashPayments, netcashStatusLabel, type NetcashPayment,
} from "@/services/netcash.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import {Wallet, RefreshCw, RotateCcw, Loader2} from "lucide-react";

const statusClass: Record<string, string> = {
  SETTLED: "bg-success/10 text-success border-success/30",
  FAILED: "bg-destructive/10 text-destructive border-destructive/30",
  PROCESSING: "bg-warning/10 text-warning border-warning/30",
  SUBMITTED: "bg-primary/10 text-primary border-primary/30",
  RETRYING: "bg-warning/10 text-warning border-warning/30",
  PENDING: "bg-muted text-muted-foreground",
};

export function NetcashBatchActions({
  batchId, batchStatus, providerStatus,
}: { batchId: string; batchStatus: string; providerStatus?: string | null }) {
  const { format } = useCurrency();
  const [payments, setPayments] = useState<NetcashPayment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try { setPayments(await listNetcashPayments(batchId)); } catch { /* ignore */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [batchId]);

  const submitted = payments.length > 0;
  const failed = payments.filter((p) => p.status === "FAILED");
  // Netcash can pay any batch that is not already fully paid or cancelled.
  const canSubmit = batchStatus === "DRAFT" || batchStatus === "CONFIRMED";

  const doSubmit = async () => {
    setBusy("submit");
    try {
      const res: any = await submitBatchToNetcash(batchId);
      if (res?.success) toast.success(`Submitted to Netcash (${res.submitted} payment(s))`);
      else toast.warning(res?.error || "Submitted with warnings");
      await load();
    } catch (e: any) { toast.error(e.message || "Netcash submission failed"); }
    finally { setBusy(null); }
  };

  const doPoll = async () => {
    setBusy("poll");
    try { await pollNetcashStatus(batchId); toast.success("Status refreshed"); await load(); }
    catch (e: any) { toast.error(e.message || "Failed to refresh"); }
    finally { setBusy(null); }
  };

  const doRetry = async (id: string) => {
    setBusy(id);
    try { await retryNetcashPayment(id); toast.success("Retry initiated"); await load(); }
    catch (e: any) { toast.error(e.message || "Retry failed"); }
    finally { setBusy(null); }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        {canSubmit && (
          <Button size="sm" variant="secondary" disabled={busy === "submit"}
            onClick={(e) => { e.stopPropagation(); doSubmit(); }} className="gap-1">
            {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {submitted ? "Re-submit to Netcash" : "Pay via Netcash"}
          </Button>
        )}
        {submitted && (
          <Button size="sm" variant="outline" disabled={busy === "poll"}
            onClick={(e) => { e.stopPropagation(); doPoll(); }} className="gap-1">
            {busy === "poll" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Status
          </Button>
        )}
        {providerStatus && (
          <Badge variant="outline" className={statusClass[providerStatus] || ""}>
            Netcash: {netcashStatusLabel(providerStatus)}
          </Badge>
        )}
      </div>

      {submitted && (
        <div className="rounded-md border border-border/50 divide-y text-sm bg-background/50">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="text-muted-foreground">{format(Number(p.amount))}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusClass[p.status] || ""}>{netcashStatusLabel(p.status)}</Badge>
                {p.status === "FAILED" && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 gap-1" disabled={busy === p.id}
                    onClick={(e) => { e.stopPropagation(); doRetry(p.id); }}>
                    {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {failed.length > 0 && (
        <p className="text-xs text-destructive">{failed.length} payment(s) failed — check supplier bank details and retry.</p>
      )}
    </div>
  );
}
