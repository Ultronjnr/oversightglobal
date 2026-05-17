import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Undo2,
  FileText,
  ExternalLink,
  Check,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  approveReimbursement,
  rejectReimbursement,
  markReimbursementPaid,
  getOrgReimbursementsByBucket,
  getOrgReimbursementBucketCounts,
  type Reimbursement,
  type ReimbursementBucket,
} from "@/services/reimbursement.service";
import { ReimbursementProofModal } from "@/components/reimbursement/ReimbursementProofModal";
import { ReimbursementDetailsModal } from "@/components/reimbursement/ReimbursementDetailsModal";
import { AddCommentDialog } from "@/components/reimbursement/AddCommentDialog";

const PAGE_SIZE = 25;
const VALID_TABS: ReimbursementBucket[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "REJECTED",
];
const URL_KEY = "rtab";

const statusConfig: Record<Reimbursement["status"], { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-warning/10 text-warning border-warning/30" },
  APPROVED: { label: "Approved", className: "bg-primary/10 text-primary border-primary/30" },
  AWAITING_PAYMENT: {
    label: "Awaiting Payment",
    className: "bg-accent/40 text-foreground border-border",
  },
  PAID: { label: "Paid", className: "bg-success/10 text-success border-success/30" },
  DECLINED: {
    label: "Declined",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

const emptyMeta: Record<ReimbursementBucket, { title: string; description: string }> = {
  PENDING: {
    title: "No Pending Reimbursements",
    description: "New employee reimbursement requests awaiting your review will appear here.",
  },
  AWAITING_PAYMENT: {
    title: "No Reimbursements Awaiting Payment",
    description: "Approved reimbursements waiting to be paid out will appear here.",
  },
  PAID: {
    title: "No Paid Reimbursements",
    description: "Completed reimbursement payouts will appear here.",
  },
  REJECTED: {
    title: "No Rejected Reimbursements",
    description: "Reimbursements that Finance has declined or rejected will appear here.",
  },
};

export function ReimbursementsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get(URL_KEY);
  const initialTab: ReimbursementBucket = (VALID_TABS as string[]).includes(urlTab || "")
    ? (urlTab as ReimbursementBucket)
    : "PENDING";

  const [subTab, setSubTab] = useState<ReimbursementBucket>(initialTab);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Reimbursement[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<ReimbursementBucket, number>>({
    PENDING: 0,
    AWAITING_PAYMENT: 0,
    PAID: 0,
    REJECTED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [proofItem, setProofItem] = useState<Reimbursement | null>(null);
  const [detailsItem, setDetailsItem] = useState<Reimbursement | null>(null);
  const [commentTarget, setCommentTarget] = useState<Reimbursement | null>(null);

  // Sync URL <-> state when user switches sub-tab
  const handleTabChange = (v: string) => {
    const next = v as ReimbursementBucket;
    setSubTab(next);
    setPage(0);
    const params = new URLSearchParams(searchParams);
    params.set(URL_KEY, next);
    setSearchParams(params, { replace: true });
  };

  // Re-sync if the URL changes externally (back/forward)
  useEffect(() => {
    const t = searchParams.get(URL_KEY);
    if (t && (VALID_TABS as string[]).includes(t) && t !== subTab) {
      setSubTab(t as ReimbursementBucket);
      setPage(0);
    }
  }, [searchParams, subTab]);

  const refreshCounts = useCallback(async () => {
    const c = await getOrgReimbursementBucketCounts();
    setCounts(c);
  }, []);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    const { rows: data, total: t } = await getOrgReimbursementsByBucket(subTab, {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setRows(data);
    setTotal(t);
    setLoading(false);
  }, [subTab, page]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const reloadAll = async () => {
    await Promise.all([fetchPage(), refreshCounts()]);
  };

  // Programmatic tab switch (state + URL) — used after state-changing actions
  // so the user is never left staring at an empty bucket.
  const goToTab = (next: ReimbursementBucket) => {
    if (next === subTab) {
      // Already there — just refresh the current page so the row is reflected.
      void fetchPage();
      return;
    }
    setSubTab(next);
    setPage(0);
    const params = new URLSearchParams(searchParams);
    params.set(URL_KEY, next);
    setSearchParams(params, { replace: true });
  };

  const openProof = (r: Reimbursement) => setProofItem(r);
  const openDetails = (r: Reimbursement) => setDetailsItem(r);

  const handleApprove = async (r: Reimbursement) => {
    setActingId(r.id);
    const res = await approveReimbursement(r.id);
    setActingId(null);
    if (!res.success) return toast.error("Approval failed", { description: res.error });
    toast.success("Reimbursement approved", { description: "Moved to Awaiting Payment queue." });
    await refreshCounts();
    goToTab("AWAITING_PAYMENT");
  };

  const handleDecline = async (r: Reimbursement) => {
    setActingId(r.id);
    const res = await rejectReimbursement(r.id);
    setActingId(null);
    if (!res.success) return toast.error("Decline failed", { description: res.error });
    toast.success("Reimbursement declined");
    await refreshCounts();
    goToTab("REJECTED");
  };

  const handleMarkPaid = async (r: Reimbursement) => {
    setActingId(r.id);
    const res = await markReimbursementPaid(r.id);
    setActingId(null);
    if (!res.success) return toast.error("Mark as paid failed", { description: res.error });
    toast.success("Reimbursement marked as paid");
    await refreshCounts();
    goToTab("PAID");
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderTable = () => (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Employee</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Proof</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const cfg = statusConfig[r.status];
            return (
              <TableRow
                key={r.id}
                className="hover:bg-muted/20 cursor-pointer"
                onClick={() => openDetails(r)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium">{r.employee_name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(Number(r.amount), r.currency)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {r.proof_document_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openProof(r)}
                      className="gap-1 text-primary hover:text-primary h-8 px-2"
                    >
                      <FileText className="h-4 w-4" />
                      View
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No proof</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <Badge variant="outline" className={cfg.className}>
                      {cfg.label}
                    </Badge>
                    {r.paid_by_employee && (
                      <Badge
                        variant="outline"
                        className="bg-accent/30 text-foreground border-border text-[10px]"
                      >
                        Employee Paid
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(r.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCommentTarget(r)}
                      className="gap-1"
                      aria-label="Add internal comment"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                      Comment
                    </Button>
                  {r.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId === r.id}
                        onClick={() => handleDecline(r)}
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                      >
                        <X className="h-3 w-3" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingId === r.id}
                        onClick={() => handleApprove(r)}
                        className="gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                    </div>
                  )}
                  {(r.status === "APPROVED" || r.status === "AWAITING_PAYMENT") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === r.id}
                      onClick={() => handleMarkPaid(r)}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Mark as Paid
                    </Button>
                  )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
    <Tabs value={subTab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList className="grid w-full grid-cols-4 max-w-2xl">
        <TabsTrigger value="PENDING" className="gap-2">
          Pending
          <Badge variant="secondary" className="ml-1">{counts.PENDING}</Badge>
        </TabsTrigger>
        <TabsTrigger value="AWAITING_PAYMENT" className="gap-2">
          Awaiting Payment
          <Badge variant="secondary" className="ml-1">{counts.AWAITING_PAYMENT}</Badge>
        </TabsTrigger>
        <TabsTrigger value="PAID" className="gap-2">
          Paid
          <Badge variant="secondary" className="ml-1">{counts.PAID}</Badge>
        </TabsTrigger>
        <TabsTrigger value="REJECTED" className="gap-2">
          Rejected
          <Badge variant="secondary" className="ml-1">{counts.REJECTED}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value={subTab} className="mt-0 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Undo2 className="h-16 w-16" />}
            title={emptyMeta[subTab].title}
            description={emptyMeta[subTab].description}
          />
        ) : (
          <>
            {renderTable()}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="text-xs">
                    Page {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
    <ReimbursementProofModal
      open={!!proofItem}
      onOpenChange={(o) => !o && setProofItem(null)}
      proofPath={proofItem?.proof_document_url ?? null}
      title="Proof of Payment"
      subtitle={proofItem ? `${proofItem.employee_name} — ${formatCurrency(Number(proofItem.amount), proofItem.currency)}` : undefined}
    />
    <ReimbursementDetailsModal
      open={!!detailsItem}
      onOpenChange={(o) => !o && setDetailsItem(null)}
      reimbursement={detailsItem}
    />
    <AddCommentDialog
      open={!!commentTarget}
      onOpenChange={(o) => !o && setCommentTarget(null)}
      reimbursementId={commentTarget?.id ?? null}
      onAdded={reloadAll}
    />
    </>
  );
}