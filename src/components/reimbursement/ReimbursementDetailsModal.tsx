import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  FileText,
  ExternalLink,
  Link2,
  History,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  getReimbursementAuditLog,
  getLinkedPRSummary,
  type Reimbursement,
  type ReimbursementAuditEntry,
  type LinkedPRSummary,
} from "@/services/reimbursement.service";
import { ReimbursementProofModal } from "./ReimbursementProofModal";
import { OcrAnalysisPanel } from "@/components/ocr/OcrAnalysisPanel";

interface ReimbursementDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reimbursement: Reimbursement | null;
}

const statusClass: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/30",
  APPROVED: "bg-primary/10 text-primary border-primary/30",
  AWAITING_PAYMENT: "bg-accent/40 text-foreground border-border",
  PAID: "bg-success/10 text-success border-success/30",
  DECLINED: "bg-destructive/10 text-destructive border-destructive/30",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/30",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

export function ReimbursementDetailsModal({
  open,
  onOpenChange,
  reimbursement,
}: ReimbursementDetailsModalProps) {
  const [audit, setAudit] = useState<ReimbursementAuditEntry[]>([]);
  const [linkedPR, setLinkedPR] = useState<LinkedPRSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !reimbursement) return;
    (async () => {
      setLoading(true);
      const [a, p] = await Promise.all([
        getReimbursementAuditLog(reimbursement.id),
        reimbursement.pr_id ? getLinkedPRSummary(reimbursement.pr_id) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setAudit(a);
        setLinkedPR(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reimbursement]);

  if (!reimbursement) return null;
  const r = reimbursement;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <DialogTitle className="text-xl font-semibold">Reimbursement Details</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Submitted {format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              <Badge variant="outline" className={statusClass[r.status] || ""}>
                {r.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Core fields */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4 text-primary" />
                Reimbursement
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border/60 bg-card p-4">
                <Field label="Employee" value={r.employee_name} />
                <Field
                  label="Amount"
                  value={
                    <span className="text-base font-semibold">
                      {formatCurrency(Number(r.amount), r.currency)}
                    </span>
                  }
                />
                {r.title && <Field label="Title" value={r.title} />}
                <Field label="Description" value={r.description} />
                <Field label="Payment Method" value={r.payment_method} />
                <Field label="Reference" value={r.reimbursement_reference} />
                <Field
                  label="Reimbursement Date"
                  value={r.reimbursement_date ? format(new Date(r.reimbursement_date), "dd MMM yyyy") : null}
                />
                <Field
                  label="Approved At"
                  value={r.approved_at ? format(new Date(r.approved_at), "dd MMM yyyy, HH:mm") : null}
                />
                <Field
                  label="Paid At"
                  value={r.paid_at ? format(new Date(r.paid_at), "dd MMM yyyy, HH:mm") : null}
                />
                <Field
                  label="Paid by Employee"
                  value={r.paid_by_employee ? "Yes" : "No"}
                />
                <Field label="Notes" value={r.notes} />
              </div>

              {r.proof_document_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProofOpen(true)}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  View Proof of Payment
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </section>

            {r.proof_document_url && (
              <section className="space-y-3">
                <OcrAnalysisPanel
                  title="Proof analysis"
                  input={{
                    document_type: "REIMBURSEMENT_PROOF",
                    bucket: "reimbursement-documents",
                    storage_path: r.proof_document_url,
                    reimbursement_id: r.id,
                    pr_id: r.pr_id ?? undefined,
                  }}
                />
              </section>
            )}

            <Separator />

            {/* Linked PR */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4 text-primary" />
                Linked Purchase Requisition
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : linkedPR ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border/60 bg-card p-4">
                  <Field
                    label="Transaction ID"
                    value={<span className="font-mono">{linkedPR.transaction_id}</span>}
                  />
                  <Field label="PR Status" value={linkedPR.status.replace(/_/g, " ")} />
                  <Field label="Requested By" value={linkedPR.requested_by_name} />
                  <Field
                    label="PR Total"
                    value={formatCurrency(Number(linkedPR.total_amount), linkedPR.currency)}
                  />
                  <Field
                    label="PR Created"
                    value={format(new Date(linkedPR.created_at), "dd MMM yyyy")}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not linked to a purchase requisition.
                </p>
              )}
            </section>

            <Separator />

            {/* Approval / audit history */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4 text-primary" />
                Approval History
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading audit log…
                </div>
              ) : audit.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No audit entries recorded yet.
                </p>
              ) : (
                <ol className="space-y-3 border-l-2 border-border pl-4">
                  {audit.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          {a.action}
                          {a.new_status && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              → {a.new_status.replace(/_/g, " ")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(a.performed_at), "dd MMM yyyy, HH:mm")}
                        </p>
                      </div>
                      {a.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <ReimbursementProofModal
        open={proofOpen}
        onOpenChange={setProofOpen}
        proofPath={r.proof_document_url}
        title="Proof of Payment"
        subtitle={`${r.employee_name} — ${formatCurrency(Number(r.amount), r.currency)}`}
      />
    </>
  );
}