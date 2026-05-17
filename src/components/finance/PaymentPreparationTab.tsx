import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Loader2,
  FileText,
  CheckSquare,
  Square,
  Banknote,
  ExternalLink,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getInvoicesAwaitingPayment,
  getInvoiceDocumentUrl,
  type InvoiceWithDetails,
} from "@/services/invoice.service";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  getOrgReimbursementsByBucket,
  getReimbursementProofUrl,
  type Reimbursement,
} from "@/services/reimbursement.service";
import { BatchPaymentModal, type BatchPaymentItem } from "./BatchPaymentModal";

interface PaymentPreparationTabProps {
  onPaymentComplete?: () => void;
}

type PayRow =
  | {
      kind: "invoice";
      key: string;
      id: string;
      party: string;
      partySub?: string;
      transactionId: string;
      amount: number;
      currency?: string;
      createdAt: string;
      documentUrl: string | null;
      status: string;
    }
  | {
      kind: "reimbursement";
      key: string;
      id: string;
      party: string;
      partySub?: string;
      transactionId: string;
      amount: number;
      currency?: string;
      createdAt: string;
      documentUrl: string | null;
      status: string;
    };

export function PaymentPreparationTab({ onPaymentComplete }: PaymentPreparationTabProps) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [invRes, reimbRes] = await Promise.all([
      getInvoicesAwaitingPayment(),
      getOrgReimbursementsByBucket("AWAITING_PAYMENT", { limit: 200, offset: 0 }),
    ]);
    if (invRes.success) setInvoices(invRes.data);
    else toast.error(invRes.error || "Failed to load invoices");
    setReimbursements(reimbRes.rows);
    setLoading(false);
  };

  const rows = useMemo<PayRow[]>(() => {
    const invRows: PayRow[] = invoices.map((inv) => ({
      kind: "invoice",
      key: `i:${inv.id}`,
      id: inv.id,
      party: inv.supplier?.company_name || "Unknown supplier",
      partySub: inv.supplier?.contact_email,
      transactionId: inv.pr?.transaction_id || "-",
      amount: Number(inv.quote?.amount || 0),
      currency: inv.pr?.currency,
      createdAt: inv.created_at,
      documentUrl: inv.document_url,
      status: inv.status,
    }));
    const reimbRows: PayRow[] = reimbursements.map((r) => ({
      kind: "reimbursement",
      key: `r:${r.id}`,
      id: r.id,
      party: r.employee_name,
      partySub: r.description,
      transactionId: r.reimbursement_reference || r.id.slice(0, 8).toUpperCase(),
      amount: Number(r.amount || 0),
      currency: r.currency,
      createdAt: r.created_at,
      documentUrl: r.proof_document_url,
      status: r.status,
    }));
    return [...invRows, ...reimbRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [invoices, reimbursements]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.key)),
    [rows, selectedIds],
  );
  const totalSelectedAmount = useMemo(
    () => selectedRows.reduce((s, r) => s + r.amount, 0),
    [selectedRows],
  );

  const batchItems: BatchPaymentItem[] = selectedRows.map((r) => ({
    kind: r.kind,
    invoiceId: r.kind === "invoice" ? r.id : undefined,
    reimbursementId: r.kind === "reimbursement" ? r.id : undefined,
    party: r.party,
    partySub: r.partySub,
    totalAmount: r.amount,
    amountPaid: 0,
    remaining: r.amount,
    currency: r.currency,
  }));

  const handleToggleSelect = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.key)));
  };

  const handleViewDocument = async (row: PayRow) => {
    if (!row.documentUrl) {
      toast.error("No document attached");
      return;
    }
    if (row.kind === "invoice") {
      const res = await getInvoiceDocumentUrl(row.documentUrl);
      if (res.success && res.url) window.open(res.url, "_blank");
      else toast.error("Failed to load document", { description: res.error });
    } else {
      const url = await getReimbursementProofUrl(row.documentUrl);
      if (url) window.open(url, "_blank");
      else toast.error("Failed to load proof");
    }
  };

  const handleCreateBatch = () => {
    if (selectedIds.size === 0) {
      toast.error("Nothing selected", {
        description: "Select at least one invoice or reimbursement to create a payment batch.",
      });
      return;
    }
    setShowBatchModal(true);
  };

  const handleBatchConfirmed = () => {
    setSelectedIds(new Set());
    void fetchAll();
    onPaymentComplete?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Banknote className="h-16 w-16" />}
        title="No Pending Payments"
        description="All invoices and reimbursements are settled. New items will appear here once approved."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="gap-2"
          >
            {selectedIds.size === rows.length ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {selectedIds.size === rows.length ? "Deselect All" : "Select All"}
          </Button>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="font-mono">
                {selectedIds.size} selected
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span className="font-medium text-primary">
                Total: {formatCurrency(totalSelectedAmount)}
              </span>
            </div>
          )}
        </div>

        <Button
          onClick={handleCreateBatch}
          disabled={selectedIds.size === 0}
          className="gap-2"
        >
          <Banknote className="h-4 w-4" />
          Create Payment Batch
          {selectedIds.size > 0 && (
            <Badge variant="secondary" className="ml-1 bg-primary-foreground/20">
              {selectedIds.size}
            </Badge>
          )}
        </Button>
      </div>

      {/* Combined Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-12"></TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Document</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.key}
                className={`cursor-pointer transition-colors ${
                  selectedIds.has(row.key)
                    ? "bg-primary/5 hover:bg-primary/10"
                    : "hover:bg-muted/20"
                }`}
                onClick={() => handleToggleSelect(row.key)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(row.key)}
                    onCheckedChange={() => handleToggleSelect(row.key)}
                  />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      row.kind === "reimbursement"
                        ? "bg-warning/10 text-warning border-warning/30"
                        : "bg-primary/10 text-primary border-primary/30"
                    }
                  >
                    {row.kind === "reimbursement" ? "Reimbursement" : "Invoice"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {row.transactionId}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{row.party}</p>
                      {row.partySub && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {row.partySub}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(row.amount, row.currency)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(row.createdAt), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  {row.documentUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleViewDocument(row);
                      }}
                      className="gap-1 text-primary hover:text-primary"
                    >
                      <FileText className="h-4 w-4" />
                      View
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Batch creation modal (supports both invoices & reimbursements) */}
      <BatchPaymentModal
        open={showBatchModal}
        onOpenChange={setShowBatchModal}
        items={batchItems}
        onConfirmed={handleBatchConfirmed}
      />
    </div>
  );
}
