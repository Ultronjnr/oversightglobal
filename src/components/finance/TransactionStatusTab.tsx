import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {Loader2, Wallet, CheckCheck, AlertCircle, Undo2, Layers} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BatchPaymentModal, type BatchPaymentItem } from "./BatchPaymentModal";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {Paperclip} from "lucide-react";

export type TransactionStatusFilter =
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "OVERDUE"
  | "REIMBURSEMENTS"
  | "BATCHES";

export type TransactionStatusCounts = Record<TransactionStatusFilter, number>;

export async function getTransactionStatusCounts(): Promise<TransactionStatusCounts> {
  const filters: TransactionStatusFilter[] = [
    "PARTIALLY_PAID",
    "FULLY_PAID",
    "OVERDUE",
    "REIMBURSEMENTS",
    "BATCHES",
  ];
  const results = await Promise.all(filters.map((f) => loadRows(f)));
  return filters.reduce((acc, f, i) => {
    acc[f] = results[i].length;
    return acc;
  }, {} as TransactionStatusCounts);
}

interface TransactionRow {
  id: string;
  transactionId: string;
  party: string;
  partySub?: string;
  totalAmount: number;
  amountPaid: number;
  remaining: number;
  status: string;
  date: string;
  currency?: string;
  prId?: string | null;
  txnId?: string | null;
  reimbursementId?: string | null;
}

const filterMeta: Record<TransactionStatusFilter, {
  title: string;
  description: string;
  icon: React.ReactNode;
  badgeClass: string;
  statusLabel: string;
}> = {
  PARTIALLY_PAID: {
    title: "No Partial Payments",
    description: "Transactions that have been partially settled will appear here.",
    icon: <Wallet className="h-16 w-16" />,
    badgeClass: "bg-warning/10 text-warning border-warning/30",
    statusLabel: "Partially Paid",
  },
  FULLY_PAID: {
    title: "No Fully Paid Transactions",
    description: "Once invoices are marked as paid, they will be listed here.",
    icon: <CheckCheck className="h-16 w-16" />,
    badgeClass: "bg-success/10 text-success border-success/30",
    statusLabel: "Fully Paid",
  },
  OVERDUE: {
    title: "No Overdue Transactions",
    description: "Approved transactions older than 30 days without full payment will appear here.",
    icon: <AlertCircle className="h-16 w-16" />,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
    statusLabel: "Overdue",
  },
  REIMBURSEMENTS: {
    title: "No Reimbursements",
    description: "Employee reimbursement requests will appear here once submitted.",
    icon: <Undo2 className="h-16 w-16" />,
    badgeClass: "bg-primary/10 text-primary border-primary/30",
    statusLabel: "Reimbursement",
  },
  BATCHES: {
    title: "No Payment Batches",
    description: "Payment batches you create will appear here for tracking and reconciliation.",
    icon: <Layers className="h-16 w-16" />,
    badgeClass: "bg-muted text-muted-foreground",
    statusLabel: "Batch",
  },
};

export function TransactionStatusTab({ filter }: { filter: TransactionStatusFilter }) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [attachRow, setAttachRow] = useState<TransactionRow | null>(null);
  const meta = filterMeta[filter];
  const supportsBatch = filter === "PARTIALLY_PAID";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const data = await loadRows(filter);
      if (!cancelled) {
        setRows(data);
        setSelectedIds(new Set());
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );
  const totalSelected = useMemo(
    () => selectedRows.reduce((sum, r) => sum + r.remaining, 0),
    [selectedRows],
  );

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );

  const handleCreateBatch = () => setBatchOpen(true);

  const batchItems: BatchPaymentItem[] = selectedRows.map((r) => ({
    kind: r.txnId ? "transaction" : "invoice",
    invoiceId: r.txnId ? undefined : r.id,
    transactionId: r.txnId ?? undefined,
    party: r.party,
    partySub: r.partySub,
    totalAmount: r.totalAmount,
    amountPaid: r.amountPaid,
    remaining: r.remaining,
    currency: r.currency,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState icon={meta.icon} title={meta.title} description={meta.description} />;
  }

  return (
    <div className="space-y-4">
      {supportsBatch && (
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-3 text-sm">
            {selectedIds.size > 0 ? (
              <>
                <Badge variant="secondary" className="font-mono">{selectedIds.size} selected</Badge>
                <span className="text-muted-foreground">•</span>
                <span className="font-medium text-primary">Total: {formatCurrency(totalSelected)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select transactions to create a payment batch.</span>
            )}
          </div>
          <Button onClick={handleCreateBatch} disabled={selectedIds.size === 0} className="gap-2">
            <Wallet className="h-4 w-4" />
            Create Batch
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="ml-1 bg-primary-foreground/20">{selectedIds.size}</Badge>
            )}
          </Button>
        </div>
      )}

    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {supportsBatch && (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === rows.length && rows.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Transaction ID</TableHead>
            <TableHead>Requester / Supplier</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right">Amount Paid</TableHead>
            <TableHead className="text-right">Remaining Balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-20 text-right">Files</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={`${selectedIds.has(row.id) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/20"}`}
            >
              {supportsBatch && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => toggleOne(row.id)}
                  />
                </TableCell>
              )}
              <TableCell className="font-mono text-sm font-medium">{row.transactionId}</TableCell>
              <TableCell>
                <p className="font-medium">{row.party}</p>
                {row.partySub && (
                  <p className="text-xs text-muted-foreground">{row.partySub}</p>
                )}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(row.totalAmount, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.amountPaid, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.remaining, row.currency)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={meta.badgeClass}>
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {row.date ? format(new Date(row.date), "dd MMM yyyy") : "-"}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttachRow(row)}
                  className="gap-1 h-8 px-2"
                  aria-label="Attachments"
                  disabled={!row.prId && !row.txnId && !row.reimbursementId}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    {supportsBatch && (
      <BatchPaymentModal
        open={batchOpen}
        onOpenChange={setBatchOpen}
        items={batchItems}
        onConfirmed={() => {
          setSelectedIds(new Set());
          setReloadKey((k) => k + 1);
        }}
      />
    )}
    <Dialog open={!!attachRow} onOpenChange={(o) => !o && setAttachRow(null)}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Attachments — {attachRow?.transactionId}</DialogTitle>
        </DialogHeader>
        {attachRow && (
          <AttachmentsPanel
            filter={
              attachRow.reimbursementId
                ? { reimbursement_id: attachRow.reimbursementId }
                : attachRow.prId
                ? { pr_id: attachRow.prId }
                : { transaction_id: attachRow.txnId ?? undefined }
            }
            targets={{
              pr_id: attachRow.prId ?? null,
              transaction_id: attachRow.txnId ?? null,
              reimbursement_id: attachRow.reimbursementId ?? null,
            }}
            defaultSupplierName={attachRow.party}
            canDelete
          />
        )}
      </DialogContent>
    </Dialog>
    </div>
  );
}

async function loadRows(filter: TransactionStatusFilter): Promise<TransactionRow[]> {
  try {
    if (filter === "REIMBURSEMENTS") {
      const { data } = await supabase
        .from("reimbursements")
        .select("id")
        .eq("status", "PENDING");
      return (data || []).map((r: any) => ({
        id: r.id,
        transactionId: r.id.slice(0, 8),
        party: "",
        totalAmount: 0,
        amountPaid: 0,
        remaining: 0,
        status: "Pending",
        date: "",
        reimbursementId: r.id,
      }));
    }

    if (filter === "BATCHES") {
      const { data } = await supabase
        .from("payment_batches")
        .select("id")
        .order("created_at", { ascending: false });
      // Return placeholder rows just for count purposes; actual UI uses BatchesTab.
      return (data || []).map((b: any) => ({
        id: b.id,
        transactionId: b.id.slice(0, 8),
        party: "",
        totalAmount: 0,
        amountPaid: 0,
        remaining: 0,
        status: "Batch",
        date: "",
      }));
    }

    if (filter === "PARTIALLY_PAID") {
      const { data } = await supabase
        .from("invoices")
        .select("id, transaction_id, status, created_at, updated_at, supplier:suppliers(company_name, contact_email), pr:purchase_requisitions(id, transaction_id, currency), quote:quotes(amount)")
        .eq("status", "PARTIALLY_PAID")
        .order("updated_at", { ascending: false });
      const invoices = (data || []) as any[];
      const ids = invoices.map((i) => i.id);
      const paidMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: allocs } = await supabase
          .from("payment_allocations")
          .select("invoice_id, amount_paid")
          .in("invoice_id", ids);
        (allocs || []).forEach((a: any) => {
          paidMap[a.invoice_id] = (paidMap[a.invoice_id] || 0) + Number(a.amount_paid);
        });
      }
      const invRows = invoices.map((inv) => {
        const total = inv.quote?.amount || 0;
        const paid = paidMap[inv.id] || 0;
        return {
          id: inv.id,
          transactionId: inv.pr?.transaction_id || "-",
          party: inv.supplier?.company_name || "-",
          partySub: inv.supplier?.contact_email,
          totalAmount: total,
          amountPaid: paid,
          remaining: Math.max(total - paid, 0),
          status: "Partially Paid",
          date: inv.updated_at || inv.created_at,
          currency: inv.pr?.currency,
          prId: inv.pr?.id ?? null,
          txnId: inv.transaction_id ?? null,
        };
      });
      const { data: txns } = await supabase
        .from("transactions" as any)
        .select("id, pr_id, amount, amount_paid, currency, updated_at, supplier_name, pr:purchase_requisitions(transaction_id, requested_by_name)")
        .in("status", ["PAYMENT_BATCH", "PARTIALLY_PAID"])
        .order("updated_at", { ascending: false });
      const txnRows: TransactionRow[] = ((txns as any[]) || []).map((t) => ({
        id: t.id,
        transactionId: t.pr?.transaction_id || t.id.slice(0, 8),
        party: t.supplier_name || t.pr?.requested_by_name || "Approved Transaction",
        totalAmount: Number(t.amount || 0),
        amountPaid: Number(t.amount_paid || 0),
        remaining: Math.max(Number(t.amount || 0) - Number(t.amount_paid || 0), 0),
        status: "Partially Paid",
        date: t.updated_at,
        currency: t.currency,
        prId: t.pr_id ?? null,
        txnId: t.id,
      }));
      const invoiceTxnIds = new Set(invRows.map((row) => row.txnId).filter(Boolean));
      return [...invRows, ...txnRows.filter((row) => !invoiceTxnIds.has(row.txnId))];
    }

    if (filter === "FULLY_PAID") {
      const { data } = await supabase
        .from("invoices")
        .select("id, transaction_id, status, created_at, updated_at, supplier:suppliers(company_name, contact_email), pr:purchase_requisitions(id, transaction_id, currency), quote:quotes(amount)")
        .eq("status", "PAID")
        .order("updated_at", { ascending: false });
      const invRows = (data || []).map((inv: any) => {
        const total = inv.quote?.amount || 0;
        return {
          id: inv.id,
          transactionId: inv.pr?.transaction_id || "-",
          party: inv.supplier?.company_name || "-",
          partySub: inv.supplier?.contact_email,
          totalAmount: total,
          amountPaid: total,
          remaining: 0,
          status: "Fully Paid",
          date: inv.updated_at || inv.created_at,
          currency: inv.pr?.currency,
          prId: inv.pr?.id ?? null,
          txnId: inv.transaction_id ?? null,
        };
      });
      const { data: txns } = await supabase
        .from("transactions" as any)
        .select("id, pr_id, amount, amount_paid, currency, paid_at, updated_at, supplier_name, pr:purchase_requisitions(transaction_id, requested_by_name)")
        .in("status", ["PAID", "COMPLETED", "FULLY_PAID"])
        .order("paid_at", { ascending: false });
      const txnRows: TransactionRow[] = ((txns as any[]) || []).map((t) => ({
        id: t.id,
        transactionId: t.pr?.transaction_id || t.id.slice(0, 8),
        party: t.supplier_name || t.pr?.requested_by_name || "Approved Transaction",
        totalAmount: Number(t.amount || 0),
        amountPaid: Number(t.amount || 0),
        remaining: 0,
        status: "Fully Paid",
        date: t.paid_at || t.updated_at,
        currency: t.currency,
        prId: t.pr_id ?? null,
        txnId: t.id,
      }));
      const invoiceTxnIds = new Set(invRows.map((row) => row.txnId).filter(Boolean));
      return [...invRows, ...txnRows.filter((row) => !invoiceTxnIds.has(row.txnId))];
    }

    if (filter === "OVERDUE") {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const cutoffMs = cutoffDate.getTime();

      // 1. Invoices: UPLOADED / AWAITING_PAYMENT / PARTIALLY_PAID with PR.payment_due_date < cutoff
      const { data: invData } = await supabase
        .from("invoices")
        .select(
          "id, status, created_at, updated_at, supplier:suppliers(company_name, contact_email), pr:purchase_requisitions(id, transaction_id, currency, payment_due_date), quote:quotes(amount)"
        )
        .in("status", ["UPLOADED", "AWAITING_PAYMENT", "PARTIALLY_PAID"]);
      const invoices = (invData || []) as any[];
      const invIds = invoices.map((i) => i.id);
      const paidMap: Record<string, number> = {};
      if (invIds.length > 0) {
        const { data: allocs } = await supabase
          .from("payment_allocations")
          .select("invoice_id, amount_paid")
          .in("invoice_id", invIds);
        (allocs || []).forEach((a: any) => {
          paidMap[a.invoice_id] = (paidMap[a.invoice_id] || 0) + Number(a.amount_paid || 0);
        });
      }

      const invoiceRows: TransactionRow[] = invoices
        .map((inv) => {
          const total = Number(inv.quote?.amount || 0);
          const paid = paidMap[inv.id] || 0;
          const remaining = Math.max(total - paid, 0);
          const dueStr = inv.pr?.payment_due_date;
          const dueMs = dueStr ? new Date(dueStr).getTime() : NaN;
          return { inv, total, paid, remaining, dueMs, dueStr };
        })
        .filter((x) => Number.isFinite(x.dueMs) && x.dueMs < cutoffMs && x.remaining > 0)
        .map(({ inv, total, paid, remaining, dueStr }) => ({
          id: inv.id,
          transactionId: inv.pr?.transaction_id || "-",
          party: inv.supplier?.company_name || "-",
          partySub: inv.supplier?.contact_email,
          totalAmount: total,
          amountPaid: paid,
          remaining,
          status: "Overdue 30+ days",
          date: dueStr,
          currency: inv.pr?.currency,
          prId: inv.pr?.id ?? null,
        }));

      // 2. Reimbursements: APPROVED but not yet PAID, approved over 30 days ago
      const { data: reimbData } = await supabase
        .from("reimbursements")
        .select("id, employee_name, amount, currency, status, approved_at, created_at")
        .eq("status", "APPROVED");
      const reimbRows: TransactionRow[] = (reimbData || [])
        .map((r: any) => {
          const refDate = r.approved_at || r.created_at;
          const refMs = refDate ? new Date(refDate).getTime() : NaN;
          return { r, refMs, refDate };
        })
        .filter((x) => Number.isFinite(x.refMs) && x.refMs < cutoffMs)
        .map(({ r, refDate }) => ({
          id: r.id,
          transactionId: r.id.slice(0, 8),
          party: r.employee_name || "Reimbursement",
          partySub: "Employee reimbursement",
          totalAmount: Number(r.amount || 0),
          amountPaid: 0,
          remaining: Number(r.amount || 0),
          status: "Overdue 30+ days",
          date: refDate,
          currency: r.currency || "ZAR",
          reimbursementId: r.id,
        }));

      return [...invoiceRows, ...reimbRows].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    }

    // Partially Paid, Reimbursements, Batches: not modeled yet — return empty
    return [];
  } catch (e) {
    console.error("TransactionStatusTab load error", e);
    return [];
  }
}