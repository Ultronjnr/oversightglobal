import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Loader2,
  Undo2,
  FileText,
  ExternalLink,
  Check,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import {
  getMyReimbursements,
  type Reimbursement,
  type ReimbursementStatus,
} from "@/services/reimbursement.service";
import { ReimbursementProofModal } from "@/components/reimbursement/ReimbursementProofModal";
import { ReimbursementDetailsModal } from "@/components/reimbursement/ReimbursementDetailsModal";
import { SubmitStandaloneReimbursementModal } from "@/components/pr/SubmitStandaloneReimbursementModal";

type EmpSubView = "SUBMITTED" | "APPROVED" | "AWAITING_PAYMENT" | "PAID";
const EMP_TABS: EmpSubView[] = ["SUBMITTED", "APPROVED", "AWAITING_PAYMENT", "PAID"];
const URL_KEY = "ertab";

const tabLabel: Record<EmpSubView, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID: "Paid",
};

function bucketOf(status: ReimbursementStatus): EmpSubView | null {
  switch (status) {
    case "PENDING":
      return "SUBMITTED";
    case "APPROVED":
      return "APPROVED";
    case "AWAITING_PAYMENT":
      return "AWAITING_PAYMENT";
    case "PAID":
      return "PAID";
    default:
      return null; // declined/rejected hidden from sub-views
  }
}

const STEPS: { key: ReimbursementStatus; label: string; icon: React.ReactNode }[] = [
  { key: "PENDING", label: "Submitted", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "APPROVED", label: "Approved", icon: <Check className="h-3.5 w-3.5" /> },
  { key: "AWAITING_PAYMENT", label: "Awaiting Payment", icon: <Coins className="h-3.5 w-3.5" /> },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get(URL_KEY);
  const initialView: EmpSubView =
    urlTab && (EMP_TABS as string[]).includes(urlTab) ? (urlTab as EmpSubView) : "SUBMITTED";

  const [view, setView] = useState<EmpSubView>(initialView);
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofItem, setProofItem] = useState<Reimbursement | null>(null);
  const [detailsItem, setDetailsItem] = useState<Reimbursement | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  const reload = async () => {
    const data = await getMyReimbursements();
    setItems(data);
  };

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

  // Sync URL when changed via UI
  const handleViewChange = (v: string) => {
    const next = v as EmpSubView;
    setView(next);
    const params = new URLSearchParams(searchParams);
    params.set(URL_KEY, next);
    setSearchParams(params, { replace: true });
  };

  const goToView = (next: EmpSubView) => {
    if (next !== view) {
      setView(next);
      const params = new URLSearchParams(searchParams);
      params.set(URL_KEY, next);
      setSearchParams(params, { replace: true });
    }
  };

  // Re-sync if URL changes externally (back/forward)
  useEffect(() => {
    const t = searchParams.get(URL_KEY);
    if (t && (EMP_TABS as string[]).includes(t) && t !== view) {
      setView(t as EmpSubView);
    }
  }, [searchParams, view]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const counts: Record<EmpSubView, number> = {
    SUBMITTED: 0,
    APPROVED: 0,
    AWAITING_PAYMENT: 0,
    PAID: 0,
  };
  items.forEach((r) => {
    const b = bucketOf(r.status);
    if (b) counts[b] += 1;
  });
  const visible = items.filter((r) => bucketOf(r.status) === view);

  const renderList = () => (
    <div className="space-y-3">
      {visible.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-border/60 bg-card p-4 space-y-3 shadow-sm cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setDetailsItem(r)}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium leading-tight">{r.title || r.description}</p>
              {r.title && r.description && r.title !== r.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
              )}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setProofItem(r);
                }}
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

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">My Reimbursements</h2>
          <p className="text-sm text-muted-foreground">
            Track every claim you've submitted and its status.
          </p>
        </div>
        <Button onClick={() => setSubmitOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Submit Reimbursement
        </Button>
      </div>

      <Tabs value={view} onValueChange={handleViewChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          {EMP_TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="gap-2">
              {tabLabel[t]}
              <Badge variant="secondary" className="ml-1">{counts[t]}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={view} className="mt-0">
          {visible.length === 0 ? (
            <EmptyState
              icon={<Undo2 className="h-16 w-16" />}
              title={`No ${tabLabel[view]} Reimbursements`}
              description="Reimbursements in this stage will appear here as their status changes."
            />
          ) : (
            renderList()
          )}
        </TabsContent>
      </Tabs>

      <ReimbursementProofModal
        open={!!proofItem}
        onOpenChange={(o) => !o && setProofItem(null)}
        proofPath={proofItem?.proof_document_url ?? null}
        title="Proof of Payment"
        subtitle={proofItem ? formatCurrency(Number(proofItem.amount), proofItem.currency) : undefined}
      />
      <ReimbursementDetailsModal
        open={!!detailsItem}
        onOpenChange={(o) => !o && setDetailsItem(null)}
        reimbursement={detailsItem}
      />

      <SubmitStandaloneReimbursementModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSubmitted={async () => {
          await reload();
          goToView("SUBMITTED");
        }}
      />
    </>
  );
}
