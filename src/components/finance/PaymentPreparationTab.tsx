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
  X,
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
  markInvoicesAsPaid,
  type InvoiceWithDetails,
} from "@/services/invoice.service";

interface PaymentPreparationTabProps {
  onPaymentComplete?: () => void;
}

export function PaymentPreparationTab({ onPaymentComplete }: PaymentPreparationTabProps) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingInvoiceUrl, setViewingInvoiceUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    const result = await getInvoicesAwaitingPayment();
    if (result.success) {
      setInvoices(result.data);
    } else {
      toast.error(result.error || "Failed to load invoices");
    }
    setLoading(false);
  };

  const selectedInvoices = useMemo(() => {
    return invoices.filter((inv) => selectedIds.has(inv.id));
  }, [invoices, selectedIds]);

  const totalSelectedAmount = useMemo(() => {
    return selectedInvoices.reduce((sum, inv) => sum + (inv.quote?.amount || 0), 0);
  }, [selectedInvoices]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  };

  const handleViewInvoice = async (documentUrl: string) => {
    const result = await getInvoiceDocumentUrl(documentUrl);
    if (result.success && result.url) {
      window.open(result.url, "_blank");
    } else {
      toast.error(result.error || "Failed to get document URL");
    }
  };

  const handleCreateBatch = () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one invoice");
      return;
    }
    setShowBatchModal(true);
  };

  const handleMarkAsPaid = async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    const result = await markInvoicesAsPaid(Array.from(selectedIds));
    
    if (result.success) {
      toast.success(`${selectedIds.size} invoice(s) marked as paid`);
      setSelectedIds(new Set());
      setShowBatchModal(false);
      fetchInvoices();
      onPaymentComplete?.();
    } else {
      toast.error(result.error || "Failed to mark invoices as paid");
    }
    setIsProcessing(false);
  };

  const formatCurrency = (amount: number, currency: string = "ZAR") => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={<Banknote className="h-16 w-16" />}
        title="No Pending Payments"
        description="All invoices have been paid. New invoices will appear here when suppliers upload them for approved PRs."
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
            {selectedIds.size === invoices.length ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {selectedIds.size === invoices.length ? "Deselect All" : "Select All"}
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

      {/* Invoices Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-12"></TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className={`cursor-pointer transition-colors ${
                  selectedIds.has(invoice.id)
                    ? "bg-primary/5 hover:bg-primary/10"
                    : "hover:bg-muted/20"
                }`}
                onClick={() => handleToggleSelect(invoice.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(invoice.id)}
                    onCheckedChange={() => handleToggleSelect(invoice.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {invoice.pr?.transaction_id || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invoice.supplier?.company_name || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.supplier?.contact_email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(invoice.quote?.amount || 0, invoice.pr?.currency)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      invoice.status === "AWAITING_PAYMENT"
                        ? "bg-warning/10 text-warning border-warning/30"
                        : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                    }
                  >
                    {invoice.status === "AWAITING_PAYMENT" ? "Awaiting Payment" : "Invoice Uploaded"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(invoice.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewInvoice(invoice.document_url);
                    }}
                    className="gap-1 text-primary hover:text-primary"
                  >
                    <FileText className="h-4 w-4" />
                    View
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payment Batch Confirmation Modal */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              Payment Batch Confirmation
            </DialogTitle>
            <DialogDescription>
              Review the selected invoices before marking them as paid. This action is for
              record-keeping purposes only - no actual payment will be processed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Batch Summary */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invoices in Batch</span>
                <span className="text-lg font-semibold">{selectedInvoices.length}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(totalSelectedAmount)}
                </span>
              </div>
            </div>

            {/* Invoice List */}
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border/50">
              {selectedInvoices.map((invoice, index) => (
                <div
                  key={invoice.id}
                  className={`flex items-center justify-between p-3 ${
                    index > 0 ? "border-t border-border/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invoice.supplier?.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.pr?.transaction_id}
                      </p>
                    </div>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(invoice.quote?.amount || 0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-sm text-warning">
                This action will mark these invoices as paid in the system. Ensure payment has
                been processed through your banking system before confirming.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowBatchModal(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
