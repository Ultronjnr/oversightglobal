import { Fragment, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  ExternalLink,
  Layers,
  Loader2,
  Building2,
  CheckCircle2,
  X as XIcon,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { getInvoiceDocumentUrl } from "@/services/invoice.service";
import {
  exportBatchToExcel,
  exportBatchToPdf,
  batchStatusLabel,
  type BatchExportData,
} from "@/services/batch-export.service";

interface BatchAllocation {
  id: string;
  invoice_id: string | null;
  transaction_id: string | null;
  amount_paid: number;
  invoice?: {
    id: string;
    document_url: string;
    status: string;
    quote?: { amount: number };
    supplier?: { id: string; company_name: string; contact_email: string; vat_number: string | null; supplier_code: string | null };
    pr?: { transaction_id: string; currency: string };
  } | null;
  transaction?: {
    id: string;
    supplier_name: string | null;
    amount: number | null;
    amount_paid: number | null;
    currency: string | null;
    status: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_branch_code?: string | null;
    bank_account_type?: string | null;
    supplier?: { id: string; company_name: string; contact_email: string; vat_number: string | null; supplier_code: string | null } | null;
    pr?: { transaction_id: string; currency: string } | null;
  } | null;
}

interface BatchRow {
  id: string;
  created_at: string;
  total_amount: number;
  currency: string;
  notes: string | null;
  status: string;
  batch_number: string | null;
  payment_reference: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  created_by: string | null;
  export_id: string | null;
  exported_at: string | null;
  allocations: BatchAllocation[];
}

export function BatchesTab() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmBatch, setConfirmBatch] = useState<BatchRow | null>(null);
  const [confirmRef, setConfirmRef] = useState("");
  const [confirmDate, setConfirmDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [orgName, setOrgName] = useState<string>("OVASYT");
  const [creators, setCreators] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<string>("");
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_batches")
      .select(
        `id, created_at, total_amount, currency, notes, status, batch_number, payment_reference, confirmed_at, paid_at, created_by, export_id, exported_at,
         allocations:payment_allocations (
           id, invoice_id, transaction_id, amount_paid,
           invoice:invoices (
             id, document_url, status,
             quote:quotes ( amount ),
             supplier:suppliers ( company_name, contact_email, vat_number, supplier_code, bank_name, bank_account_number, bank_branch_code, bank_account_type ),
             pr:purchase_requisitions ( transaction_id, currency )
           ),
           transaction:transactions (
             id, supplier_name, amount, amount_paid, currency, status,
             bank_name, bank_account_number, bank_branch_code, bank_account_type,
             supplier:suppliers ( company_name, contact_email, vat_number, supplier_code, bank_name, bank_account_number, bank_branch_code, bank_account_type ),
             pr:purchase_requisitions ( transaction_id, currency )
           )
         )`,
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load batches", { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data || []) as any as BatchRow[];
    setBatches(rows);

    // Resolve organization name + creator names + current user for the report header
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    const creatorIds = Array.from(
      new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]),
    );
    const ids = Array.from(new Set([...creatorIds, ...(uid ? [uid] : [])]));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, surname, organization_id")
        .in("id", ids);
      const map: Record<string, string> = {};
      let orgId: string | undefined;
      (profs || []).forEach((p: any) => {
        map[p.id] = [p.name, p.surname].filter(Boolean).join(" ") || "—";
        if (p.id === uid) orgId = p.organization_id;
      });
      setCreators(map);
      if (uid && map[uid]) setCurrentUser(map[uid]);
      if (orgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .single();
        if (org?.name) setOrgName(org.name);
      }
    }
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleViewInvoice = async (path: string) => {
    const result = await getInvoiceDocumentUrl(path);
    if (result.success && result.url) {
      window.open(result.url, "_blank");
    } else {
      toast.error("Failed to load invoice", { description: result.error });
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-success/10 text-success border-success/30";
      case "CONFIRMED":
        return "bg-primary/10 text-primary border-primary/30";
      case "CANCELLED":
        return "bg-muted text-muted-foreground border-border";
      case "DRAFT":
      default:
        return "bg-warning/10 text-warning border-warning/30";
    }
  };

  const buildExportData = (b: BatchRow): BatchExportData => ({
    batch_number: b.batch_number || b.id.slice(0, 8).toUpperCase(),
    created_at: b.created_at,
    status: b.status || "DRAFT",
    payment_reference: b.payment_reference,
    paid_at: b.paid_at,
    notes: b.notes,
    currency: b.currency || "ZAR",
    total_amount: Number(b.total_amount || 0),
    batch_name: b.notes || (b.batch_number ? `Batch ${b.batch_number}` : null),
    service_type: "Creditor Payments",
    created_by_name: (b.created_by && creators[b.created_by]) || "—",
    organization_name: orgName,
    export_id: b.export_id,
    system_user: currentUser || (b.created_by && creators[b.created_by]) || "—",
    netcash_status: b.export_id ? "Exported — Ready for Netcash Import" : "Ready for Netcash Import",
    allocations: b.allocations.map((a) => {
      const supplierName =
        a.invoice?.supplier?.company_name ||
        a.transaction?.supplier?.company_name ||
        a.transaction?.supplier_name ||
        "—";
      const contact =
        a.invoice?.supplier?.contact_email ||
        a.transaction?.supplier?.contact_email ||
        null;
      const txnRef =
        a.invoice?.pr?.transaction_id ||
        a.transaction?.pr?.transaction_id ||
        a.transaction_id?.slice(0, 8) ||
        a.invoice_id?.slice(0, 8) ||
        "—";
      const total =
        Number(a.invoice?.quote?.amount || a.transaction?.amount || 0);
      const currency =
        a.invoice?.pr?.currency || a.transaction?.currency || a.transaction?.pr?.currency;
      const isFull =
        a.invoice?.status === "PAID" || a.transaction?.status === "PAID";
      const vatNumber =
        a.invoice?.supplier?.vat_number || a.transaction?.supplier?.vat_number || null;
      const supplierCode =
        a.invoice?.supplier?.supplier_code || a.transaction?.supplier?.supplier_code || null;
      const prNumber =
        a.invoice?.pr?.transaction_id || a.transaction?.pr?.transaction_id || "—";
      const sup = a.invoice?.supplier || a.transaction?.supplier;
      const accountNumber =
        a.transaction?.bank_account_number || sup?.bank_account_number || null;
      const branchCode =
        a.transaction?.bank_branch_code || sup?.bank_branch_code || null;
      const accountType =
        a.transaction?.bank_account_type || sup?.bank_account_type || "Current/Cheque";
      return {
        supplier: supplierName,
        contact,
        transaction_ref: txnRef,
        amount_paid: Number(a.amount_paid || 0),
        total_amount: total,
        type: isFull ? "Full" : "Partial",
        currency,
        invoice_ref: a.invoice_id ? a.invoice_id.slice(0, 8).toUpperCase() : txnRef,
        supplier_account: accountNumber || supplierCode || "—",
        branch_code: branchCode || "—",
        account_type: accountType || "—",
        statement_ref: b.payment_reference || txnRef,
        pr_number: prNumber,
        vat_registered: !!vatNumber,
        payment_status: isFull ? "Paid" : batchStatusLabel(b.status),
      };
    }),
  });

  const handleExportPdf = async (b: BatchRow) => {
    setExportingId(b.id);
    try {
      // 1. Register the export — generates a unique Export ID and locks against duplicates
      const { data, error } = await supabase.rpc("register_batch_export", { _batch_id: b.id });
      const res: any = data;
      if (error || !res?.success) {
        toast.error("Failed to prepare export", { description: error?.message || res?.error });
        return;
      }
      const exportId: string = res.export_id;
      if (res.already_exported) {
        toast.info("This batch was already exported", {
          description: "Re-downloading the locked report with its original Export ID.",
        });
      }

      // 2. Build the PDF with the export metadata
      const exportData = { ...buildExportData(b), export_id: exportId };
      const blob = await exportBatchToPdf(exportData, { download: true });

      // 3. Store a copy in batch history (best-effort)
      try {
        const { data: auth } = await supabase.auth.getUser();
        const { data: prof } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", auth?.user?.id || "")
          .single();
        const orgId = prof?.organization_id;
        if (orgId) {
          const path = `${orgId}/${b.id}/${exportId}.pdf`;
          const up = await supabase.storage
            .from("batch-exports")
            .upload(path, blob, { contentType: "application/pdf", upsert: true });
          if (!up.error) {
            await supabase.rpc("attach_batch_export_pdf", {
              _batch_id: b.id,
              _export_id: exportId,
              _file_path: path,
            });
          }
        }
      } catch {
        /* storage copy is best-effort */
      }

      toast.success("Batch report exported", { description: `Export ID: ${exportId.slice(0, 8)}…` });
      void fetchBatches();
    } finally {
      setExportingId(null);
    }
  };

  const handleCancelBatch = async (batchId: string) => {
    if (!window.confirm("Cancel this draft batch? All allocations will be removed.")) return;
    const { data, error } = await supabase.rpc("cancel_batch_draft", { _batch_id: batchId });
    const res: any = data;
    if (error || !res?.success) {
      toast.error("Failed to cancel batch", { description: error?.message || res?.error });
      return;
    }
    toast.success("Batch cancelled");
    void fetchBatches();
  };

  const handleConfirmBatch = async () => {
    if (!confirmBatch) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("confirm_batch_paid", {
      _batch_id: confirmBatch.id,
      _payment_reference: confirmRef || null,
      _payment_date: confirmDate || null,
    });
    setSubmitting(false);
    const res: any = data;
    if (error || !res?.success) {
      toast.error("Failed to confirm batch", { description: error?.message || res?.error });
      return;
    }
    toast.success(`Batch ${confirmBatch.batch_number || ""} confirmed as paid`);
    setConfirmBatch(null);
    setConfirmRef("");
    void fetchBatches();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-16 w-16" />}
        title="No Payment Batches"
        description="Payment batches you create will appear here for tracking and reconciliation."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10"></TableHead>
            <TableHead>Batch ID</TableHead>
            <TableHead>Date Created</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right"># Transactions</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => {
            const isOpen = expanded.has(b.id);
            const status = b.status || "DRAFT";
            return (
              <Fragment key={b.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/20"
                  onClick={() => toggleExpand(b.id)}
                >
                  <TableCell>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {b.batch_number || b.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(b.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(b.total_amount), b.currency)}
                  </TableCell>
                  <TableCell className="text-right">{b.allocations.length}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(status)}>
                      {batchStatusLabel(status)}
                    </Badge>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={6} className="p-4">
                      {b.notes && (
                        <p className="text-sm text-muted-foreground mb-3">
                          <span className="font-medium text-foreground">Notes:</span> {b.notes}
                        </p>
                      )}
                      {(b.payment_reference || b.paid_at) && (
                        <div className="text-xs text-muted-foreground mb-3 flex gap-4 flex-wrap">
                          {b.payment_reference && (
                            <span><span className="font-medium text-foreground">Reference:</span> {b.payment_reference}</span>
                          )}
                          {b.paid_at && (
                            <span><span className="font-medium text-foreground">Paid:</span> {format(new Date(b.paid_at), "dd MMM yyyy HH:mm")}</span>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {status === "DRAFT" && (
                          <>
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setConfirmBatch(b); }}
                            className="gap-1"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Confirm Paid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleCancelBatch(b.id); }}
                            className="gap-1"
                          >
                            <XIcon className="h-4 w-4" />
                            Cancel Batch
                          </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); exportBatchToExcel(buildExportData(b)); }}
                          className="gap-1"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          Export Excel
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={exportingId === b.id}
                          onClick={(e) => { e.stopPropagation(); void handleExportPdf(b); }}
                          className="gap-1"
                        >
                          {exportingId === b.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4" />
                          )}
                          {b.export_id ? "Re-download PDF" : "Export PDF"}
                        </Button>
                        {b.export_id && (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30 self-center">
                            Exported
                          </Badge>
                        )}
                      </div>
                      <div className="rounded-lg border border-border/50 overflow-hidden bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead>Supplier</TableHead>
                              <TableHead>Transaction</TableHead>
                              <TableHead className="text-right">Amount Paid</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Invoice</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {b.allocations.map((a) => {
                              const total =
                                Number(a.invoice?.quote?.amount || a.transaction?.amount || 0);
                              const isFull =
                                a.invoice?.status === "PAID" ||
                                a.transaction?.status === "PAID";
                              const supplierName =
                                a.invoice?.supplier?.company_name ||
                                a.transaction?.supplier?.company_name ||
                                a.transaction?.supplier_name ||
                                "-";
                              const supplierEmail =
                                a.invoice?.supplier?.contact_email ||
                                a.transaction?.supplier?.contact_email;
                              const txnRef =
                                a.invoice?.pr?.transaction_id ||
                                a.transaction?.pr?.transaction_id ||
                                "-";
                              const currency =
                                a.invoice?.pr?.currency ||
                                a.transaction?.currency ||
                                a.transaction?.pr?.currency;
                              return (
                                <TableRow key={a.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="font-medium text-sm">
                                          {supplierName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {supplierEmail}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {txnRef}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatCurrency(
                                      Number(a.amount_paid),
                                      currency,
                                    )}
                                    <p className="text-xs text-muted-foreground font-normal">
                                      of {formatCurrency(total, currency)}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        isFull
                                          ? "bg-success/10 text-success border-success/30"
                                          : "bg-warning/10 text-warning border-warning/30"
                                      }
                                    >
                                      {isFull ? "Full" : "Partial"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {a.invoice?.document_url ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewInvoice(a.invoice!.document_url);
                                        }}
                                        className="gap-1 text-primary hover:text-primary"
                                      >
                                        <FileText className="h-4 w-4" />
                                        View Invoice
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <Dialog open={!!confirmBatch} onOpenChange={(o) => !o && setConfirmBatch(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Confirm Batch Paid
            </DialogTitle>
            <DialogDescription>
              Confirming will mark all invoices in batch{" "}
              <span className="font-mono font-semibold">{confirmBatch?.batch_number}</span>{" "}
              as paid or partially paid. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground">Payment reference</label>
              <Input
                value={confirmRef}
                onChange={(e) => setConfirmRef(e.target.value)}
                placeholder="Bank ref / EFT number"
                maxLength={120}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Payment date</label>
              <Input
                type="date"
                value={confirmDate}
                onChange={(e) => setConfirmDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBatch(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBatch} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}