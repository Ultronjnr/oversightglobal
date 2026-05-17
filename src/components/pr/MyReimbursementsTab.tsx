import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Undo2,
  FileText,
  ExternalLink,
  Check,
  Clock,
  CircleDollarSign,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import {
  getMyReimbursements,
  getReimbursementProofUrl,
  type Reimbursement,
  type ReimbursementStatus,
} from "@/services/reimbursement.service";

const STEPS: { key: ReimbursementStatus; label: string; icon: React.ReactNode }[] = [
  { key: "PENDING", label: "Submitted", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "APPROVED", label: "Approved", icon: <Check className="h-3.5 w-3.5" /> },
  { key: "AWAITING_PAYMENT", label: "Awaiting Payment", icon: <CircleDollarSign className="h-3.5 w-3.5" /> },
  { key: "PAID", label: "Paid", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

function statusIndex(status: ReimbursementStatus): number {
  switch (status) {
    case "PENDING":
      return 0;
    case "APPROVED":
      return 1;
    case "AWAITING_PAYMENT":
      return 2;
    case "PAID":
      return 3;
    default:
      return -1; // DECLINED / REJECTED
  }
}

function Timeline({ r }: { r: Reimbursement }) {
  const rejected = r.status === "REJECTED" || r.status === "DECLINED";
  const currentIdx = statusIndex(r.status);

  if (rejected) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <XCircle className="h-4 w-4 text-destructive" />
        <span className="font-medium text-destructive">
          {r.status === "REJECTED" ? "Rejected" : "Declined"}
        </span>
        {r.notes && <span className="text-muted-foreground">— {r.notes}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1.5">
            <div
              className={[
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                done
                  ? active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-success/10 text-success border-success/30"
                  : "bg-muted/40 text-muted-foreground border-border",
              ].join(" ")}
            >
              {step.icon}
              <span>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "h-px w-4",
                  i < currentIdx ? "bg-success/50" : "bg-border",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MyReimbursementsTab() {
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getMyReimbursements();
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleViewProof = async (path: string) => {
    const url = await getReimbursementProofUrl(path);
    if (!url) {
      toast.error("Failed to load proof document");
      return;
    }
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Undo2 className="h-16 w-16" />}
        title="No Reimbursements Yet"
        description="When you submit a purchase requisition that requires reimbursement, it will appear here with live status."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-border/60 bg-card p-4 space-y-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium leading-tight">{r.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Submitted {format(new Date(r.created_at), "dd MMM yyyy")}
                {r.pr_id && <span className="ml-1">• PR linked</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {formatCurrency(Number(r.amount), r.currency)}
              </p>
              {r.payment_method && (
                <p className="text-xs text-muted-foreground">via {r.payment_method}</p>
              )}
            </div>
          </div>

          <Timeline r={r} />

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-border/40">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {r.reimbursement_reference && (
                <span>
                  Reference: <span className="font-mono text-foreground">{r.reimbursement_reference}</span>
                </span>
              )}
              {r.paid_at && (
                <span>Paid on {format(new Date(r.paid_at), "dd MMM yyyy")}</span>
              )}
              {r.approved_at && !r.paid_at && (
                <span>Approved on {format(new Date(r.approved_at), "dd MMM yyyy")}</span>
              )}
              {!r.reimbursement_reference && !r.paid_at && !r.approved_at && (
                <span>Awaiting finance action</span>
              )}
            </div>
            {r.proof_document_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewProof(r.proof_document_url!)}
                className="gap-1"
              >
                <FileText className="h-4 w-4" />
                View Proof
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}