import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Receipt,
  DollarSign,
  ExternalLink,
  Download,
  Building2,
  CheckCircle2,
} from "lucide-react";
import {
  getOrganizationInvoices,
  getInvoiceDocumentUrl,
  updateInvoiceStatus,
  type Invoice,
  type InvoiceWithSupplier,
} from "@/services/invoice.service";
import { getInvoiceSignedUrl } from "@/services/invoice-export.service";
import { InvoiceExportControls } from "@/components/finance/InvoiceExportControls";
import type { InvoiceExportRow } from "@/services/invoice-export.service";
import { format } from "date-fns";

export function InvoicesTable() {
  const [invoices, setInvoices] = useState<InvoiceWithSupplier[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceExportRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({ isOpen: false, url: "", title: "" });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const result = await getOrganizationInvoices();
      if (result.success) {
        setInvoices(result.data);
      } else {
        toast.error("Failed to load invoices");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDocument = async (invoice: Invoice) => {
    const result = await getInvoiceDocumentUrl(invoice.document_url);
    if (result.success && result.url) {
      setDocumentModal({
        isOpen: true,
        url: result.url,
        title: `Invoice – ${format(new Date(invoice.created_at), "dd MMM yyyy")}`,
      });
    } else {
      toast.error("Failed to load document");
    }
  };

  const handleMarkAwaitingPayment = async (invoiceId: string) => {
    setActionLoading(invoiceId);
    try {
      const result = await updateInvoiceStatus(invoiceId, "AWAITING_PAYMENT");
      if (result.success) {
        toast.success("Invoice status updated", {
          description: "Invoice has been marked as awaiting payment.",
        });
        fetchInvoices();
      } else {
        toast.error("Failed to update invoice", {
          description: result.error || "Please try again.",
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  /** Download a single invoice PDF by generating a signed URL and triggering a browser download. */
  const handleDownloadSingleInvoice = async (invoice: Invoice) => {
    setDownloadLoading(invoice.id);
    try {
      const result = await getInvoiceSignedUrl(invoice.document_url);
      if (result.success && result.url) {
        const link = document.createElement("a");
        link.href = result.url;
        link.download = `invoice_${format(new Date(invoice.created_at), "yyyyMMdd")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Invoice download started.");
      } else {
        toast.error("Download failed", { description: result.error });
      }
    } finally {
      setDownloadLoading(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // When a date-range filter is active, show the filtered export rows (read-only).
  // When null, fall back to the full invoice list with all actions.
  const showFiltered = filteredInvoices !== null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Supplier Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {/* Date-range filter + CSV export controls */}
          <InvoiceExportControls onFilteredInvoices={setFilteredInvoices} />

          {/* ── Filtered view ─────────────────────────────────────────── */}
          {showFiltered && (
            <>
              {filteredInvoices!.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Receipt className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-1">No Invoices in Range</h3>
                  <p className="text-sm text-muted-foreground">
                    No invoices were found for the selected date range.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices!.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            {format(new Date(inv.createdAt), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {inv.transactionId}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{inv.supplierName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {inv.supplierEmail}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {new Intl.NumberFormat("en-ZA", {
                              style: "currency",
                              currency: inv.currency,
                            }).format(inv.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge type="invoice" status={inv.paymentStatus} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}

          {/* ── Full invoice list (default view) ──────────────────────── */}
          {!showFiltered && (
            <>
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Receipt className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-1">No Invoices Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Supplier invoices will appear here after quotes are accepted.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Quote ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            {format(new Date(invoice.created_at), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {invoice.supplier_company_name ?? invoice.supplier_id.slice(0, 8) + "…"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.quote_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <StatusBadge type="invoice" status={invoice.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDocument(invoice)}
                                className="gap-1"
                              >
                                <FileText className="h-4 w-4" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadSingleInvoice(invoice)}
                                disabled={downloadLoading === invoice.id}
                                className="gap-1"
                                title="Download Selected Invoice"
                              >
                                {downloadLoading === invoice.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {invoice.status === "UPLOADED" && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkAwaitingPayment(invoice.id)}
                                disabled={actionLoading === invoice.id}
                                className="gap-1"
                              >
                                {actionLoading === invoice.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <DollarSign className="h-4 w-4" />
                                    Mark Awaiting Payment
                                  </>
                                )}
                              </Button>
                            )}
                            {invoice.status === "AWAITING_PAYMENT" && (
                              <span className="text-sm text-muted-foreground">
                                Processing...
                              </span>
                            )}
                            {invoice.status === "PAID" && (
                              <span className="text-sm text-success flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" />
                                Completed
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Document Viewer Modal */}
      <Dialog
        open={documentModal.isOpen}
        onOpenChange={(open) => setDocumentModal({ ...documentModal, isOpen: open })}
      >
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {documentModal.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-[500px]">
            <iframe
              src={documentModal.url}
              className="w-full h-full rounded-lg border"
              title="Invoice Document"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => window.open(documentModal.url, "_blank")}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const link = document.createElement("a");
                link.href = documentModal.url;
                link.download = "invoice.pdf";
                link.click();
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
