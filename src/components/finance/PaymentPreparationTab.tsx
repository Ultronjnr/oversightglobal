import { useState, useEffect, useMemo, Fragment } from "react";
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
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  AlertCircle,
  Download,
  Paperclip,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  getInvoicesAwaitingPayment,
  getInvoiceDocumentUrl,
  type InvoiceWithDetails,
} from "@/services/invoice.service";
import { formatCurrency } from "@/lib/utils";
import {
  getOrgReimbursementsByBucket,
  getReimbursementProofUrl,
  type Reimbursement,
} from "@/services/reimbursement.service";
import {
  getTransactionsByStatus,
  type OrgTransaction,
} from "@/services/transaction.service";
import { getDocumentSignedUrl, getFileType } from "@/services/document.service";
import { listAttachments, getAttachmentSignedUrl } from "@/services/attachment.service";
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
      prId?: string;
      items?: any[];
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
      prId?: string;
      items?: any[];
    }
  | {
      kind: "transaction";
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
      prId?: string;
      items?: any[];
      invoiceId?: string | null;
    };

export function PaymentPreparationTab({ onPaymentComplete }: PaymentPreparationTabProps) {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [transactions, setTransactions] = useState<OrgTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [reimbRes, txnRes] = await Promise.all([
      getOrgReimbursementsByBucket("AWAITING_PAYMENT", { limit: 200, offset: 0 }),
      getTransactionsByStatus(["APPROVED_NOT_PAID", "INVOICED", "PARTIALLY_PAID"]),
    ]);
    setReimbursements(reimbRes.rows);
    setTransactions(txnRes);
    setLoading(false);
  };

  const rows = useMemo<PayRow[]>(() => {
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
    const txnRows: PayRow[] = transactions.map((t) => {
      const remaining = Math.max(Number(t.amount || 0) - Number(t.amount_paid || 0), 0);
      return {
        kind: "transaction" as const,
        key: `t:${t.id}`,
        id: t.id,
        party: t.supplier_name || t.pr?.requested_by_name || "Approved Transaction",
        partySub: t.pr?.requested_by_department || undefined,
        transactionId: t.pr?.transaction_id || t.id.slice(0, 8).toUpperCase(),
        amount: remaining,
        currency: t.currency,
        createdAt: t.approved_at,
        documentUrl: t.document_url || t.pr?.document_url || null,
        status: t.status,
        prId: t.pr?.id || t.pr_id,
        items: Array.isArray(t.pr?.items) ? (t.pr?.items as any[]) : [],
        invoiceId: t.invoice_id,
      };
    });
    return [...reimbRows, ...txnRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [reimbursements, transactions]);

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
    transactionId: r.kind === "transaction" ? r.id : undefined,
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
    } else if (row.kind === "reimbursement") {
      const url = await getReimbursementProofUrl(row.documentUrl);
      if (url) window.open(url, "_blank");
      else toast.error("Failed to load proof");
    } else if (row.kind === "transaction" && row.invoiceId) {
      // Folded supplier invoice — document lives in the invoice bucket
      const res = await getInvoiceDocumentUrl(row.documentUrl);
      if (res.success && res.url) window.open(res.url, "_blank");
      else toast.error("Failed to load document", { description: res.error });
    } else {
      // transaction: signed URL through PR document endpoint
      if (!row.prId) {
        toast.error("Missing PR reference");
        return;
      }
      const res = await getDocumentSignedUrl(row.documentUrl, row.prId);
      if (res.success && res.signed_url) window.open(res.signed_url, "_blank");
      else toast.error("Failed to load document", { description: res.error });
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
              <TableHead className="w-8"></TableHead>
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
            {rows.map((row) => {
              const isExpanded = expandedKey === row.key;
              return (
              <Fragment key={row.key}>
              <TableRow
                className={`cursor-pointer transition-colors ${
                  selectedIds.has(row.key)
                    ? "bg-primary/5 hover:bg-primary/10"
                    : "hover:bg-muted/20"
                }`}
                onClick={() => handleToggleSelect(row.key)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setExpandedKey(isExpanded ? null : row.key)}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
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
                        : row.kind === "transaction"
                        ? "bg-success/10 text-success border-success/30"
                        : "bg-primary/10 text-primary border-primary/30"
                    }
                  >
                    {row.kind === "reimbursement"
                      ? "Reimbursement"
                      : row.kind === "transaction"
                      ? (row.status === "INVOICED"
                          ? "Invoiced"
                          : row.status === "PARTIALLY_PAID"
                          ? "Part-paid"
                          : "Approved")
                      : "Invoice"}
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
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant="outline" className="border-success/30 text-success gap-1 hidden sm:inline-flex">
                        <Paperclip className="h-3 w-3" />
                        Attached
                      </Badge>
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
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                  <TableCell colSpan={8} className="p-0">
                    <ExpandedDetails row={row} />
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
              );
            })}
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

function ExpandedDetails({ row }: { row: PayRow }) {
  const [docState, setDocState] = useState<{
    loading: boolean;
    url: string | null;
    type: "pdf" | "image" | "other";
    error: string | null;
    fileName: string | null;
    uploadedAt: string | null;
  }>({ loading: true, url: null, type: "other", error: null, fileName: null, uploadedAt: null });

  // Clean up storage-mangled filenames (strip leading org/user id, timestamp and uuid prefixes)
  const prettyFileName = (name: string | null): string => {
    if (!name) return "document";
    let n = name.split("/").pop() || name;
    // remove leading numeric timestamp + uuid segments like "1712345678901-uuid-"
    n = n.replace(/^\d{10,}-/, "").replace(/^[0-9a-f]{8}-[0-9a-f-]{27,}-/i, "");
    // remove a leading prId-timestamp- pattern
    n = n.replace(/^[\w-]+?-\d{10,}-/, "");
    return n || "document";
  };

  // Extract an upload timestamp from a storage path (ms epoch embedded in filename)
  const parseUploadTime = (path: string | null): string | null => {
    if (!path) return null;
    const m = path.match(/(\d{13})/);
    if (m) {
      const d = new Date(Number(m[1]));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    setDocState({ loading: true, url: null, type: "other", error: null, fileName: null, uploadedAt: null });

    const loadAttachmentFallback = async () => {
      const filter: any = {};
      if (row.kind === "transaction") {
        filter.transaction_id = row.id;
      } else if (row.kind === "invoice") {
        filter.pr_id = row.prId;
      } else if (row.kind === "reimbursement") {
        filter.reimbursement_id = row.id;
      }
      if (row.kind === "transaction" && row.prId && !filter.transaction_id) {
        filter.pr_id = row.prId;
      }
      const res = await listAttachments(filter);
      if (!res.success || res.data.length === 0) {
        // Try by pr_id as a secondary fallback for transactions
        if (row.kind === "transaction" && row.prId) {
          const res2 = await listAttachments({ pr_id: row.prId });
          if (res2.success && res2.data.length > 0) {
            const att = res2.data[0];
            const signed = await getAttachmentSignedUrl(att.file_path);
            if (signed.success && signed.url) {
              return { url: signed.url, fileName: att.file_name, type: getFileType(att.file_name), uploadedAt: att.created_at };
            }
          }
        }
        return null;
      }
      const att = res.data[0];
      const signed = await getAttachmentSignedUrl(att.file_path);
      if (signed.success && signed.url) {
        return { url: signed.url, fileName: att.file_name, type: getFileType(att.file_name), uploadedAt: att.created_at };
      }
      return null;
    };

    (async () => {
      try {
        if (row.documentUrl && row.kind === "invoice") {
          const res = await getInvoiceDocumentUrl(row.documentUrl!);
          if (cancelled) return;
          if (res.success && res.url) {
            setDocState({
              loading: false,
              url: res.url,
              type: getFileType(row.documentUrl!),
              error: null,
              fileName: row.documentUrl!.split("/").pop() || "document",
              uploadedAt: parseUploadTime(row.documentUrl!) || row.createdAt,
            });
            return;
          }
        } else if (row.documentUrl && row.kind === "reimbursement") {
          const url = await getReimbursementProofUrl(row.documentUrl!);
          if (cancelled) return;
          if (url) {
            setDocState({
              loading: false,
              url,
              type: getFileType(row.documentUrl!),
              error: null,
              fileName: row.documentUrl!.split("/").pop() || "document",
              uploadedAt: parseUploadTime(row.documentUrl!) || row.createdAt,
            });
            return;
          }
        } else if (row.documentUrl && row.kind === "transaction" && row.prId) {
          const res = await getDocumentSignedUrl(row.documentUrl!, row.prId);
          if (cancelled) return;
          if (res.success && res.signed_url) {
            setDocState({
              loading: false,
              url: res.signed_url,
              type: res.file_type || getFileType(row.documentUrl!),
              error: null,
              fileName: row.documentUrl!.split("/").pop() || "document",
              uploadedAt: parseUploadTime(row.documentUrl!) || row.createdAt,
            });
            return;
          }
        }

        // Fallback: look in attachments table
        const fb = await loadAttachmentFallback();
        if (cancelled) return;
        if (fb) {
          setDocState({ loading: false, url: fb.url, type: fb.type, error: null, fileName: fb.fileName, uploadedAt: (fb as any).uploadedAt || null });
        } else {
          setDocState({ loading: false, url: null, type: "other", error: null, fileName: null, uploadedAt: null });
        }
      } catch (e: any) {
        if (!cancelled) setDocState({ loading: false, url: null, type: "other", error: e?.message || "Error", fileName: null, uploadedAt: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.documentUrl, row.prId, row.kind, row.id]);

  const items = row.items || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4">
      {/* Left: context / line items */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-primary" />
          Line Items
          <Badge variant="outline" className="ml-1">{items.length}</Badge>
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md border border-border/40">
            No line items captured for this transaction.
          </div>
        ) : (
          <div className="rounded-md border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it: any, idx: number) => {
                  const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
                  const unit = Number(it.unit_price ?? it.price ?? 0) || 0;
                  const total = Number(it.total_price ?? it.total ?? unit * qty) || 0;
                  const desc = it.description || it.name || it.item_name || "Item";
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{desc}</TableCell>
                      <TableCell className="text-right text-sm">{qty}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(unit, row.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(total, row.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
          <div className="p-2 rounded-md bg-muted/30 border border-border/40">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium">{row.status}</p>
          </div>
          <div className="p-2 rounded-md bg-muted/30 border border-border/40">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-medium">{formatCurrency(row.amount, row.currency)}</p>
          </div>
        </div>
      </div>

      {/* Right: document preview */}
      <div className="lg:col-span-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-primary" />
            Document
          </div>
          {docState.url && (
            <div className="flex items-center gap-1">
              <a
                href={docState.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline px-2 py-1 rounded hover:bg-primary/10"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={docState.url}
                download={docState.fileName || "document"}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline px-2 py-1 rounded hover:bg-primary/10"
              >
                <Download className="h-3 w-3" /> Download
              </a>
            </div>
          )}
        </div>
        {docState.url && (
          <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2">
            <Paperclip className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-success">Invoice attached</p>
              <p className="text-xs text-foreground/80 truncate" title={prettyFileName(docState.fileName)}>
                {prettyFileName(docState.fileName)}
              </p>
              {docState.uploadedAt && (
                <p className="text-xs text-muted-foreground">
                  Uploaded {format(new Date(docState.uploadedAt), "dd MMM yyyy 'at' HH:mm")}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="rounded-md border border-border/40 bg-muted/20 overflow-hidden h-[420px] flex items-center justify-center">
          {docState.loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : docState.error ? (
            <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{docState.error}</p>
            </div>
          ) : !docState.url ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
              <FileText className="h-8 w-8 opacity-50" />
              <p className="text-sm">No document attached</p>
            </div>
          ) : docState.type === "image" ? (
            <img src={docState.url!} alt="Document" className="max-h-full max-w-full object-contain" />
          ) : docState.type === "pdf" ? (
            <iframe src={docState.url!} title="Document" className="w-full h-full" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
              <FileText className="h-8 w-8 opacity-50" />
              <p className="text-sm">Preview not available</p>
              <a href={docState.url!} target="_blank" rel="noreferrer" className="text-primary text-xs inline-flex items-center gap-1 hover:underline">
                Download <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
