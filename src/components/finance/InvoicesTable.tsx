import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Receipt,
  Clock,
  DollarSign,
  CheckCircle,
  ExternalLink,
  Download,
  Building2,
} from "lucide-react";
import { getOrganizationInvoices, getInvoiceDocumentUrl, updateInvoiceStatus, type Invoice } from "@/services/invoice.service";
import { format } from "date-fns";

export function InvoicesTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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
        title: `Invoice - ${format(new Date(invoice.created_at), "dd MMM yyyy")}`,
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
        toast.success("Invoice marked as awaiting payment");
        fetchInvoices();
      } else {
        toast.error(result.error || "Failed to update invoice");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UPLOADED":
        return (
          <Badge variant="outline" className="border-primary/30 text-primary">
            <Receipt className="h-3 w-3 mr-1" />
            Uploaded
          </Badge>
        );
      case "AWAITING_PAYMENT":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Clock className="h-3 w-3 mr-1" />
            Awaiting Payment
          </Badge>
        );
      case "PAID":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Supplier Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                          <span className="font-mono text-sm">{invoice.supplier_id.slice(0, 8)}...</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {invoice.quote_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument(invoice)}
                          className="gap-1"
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </Button>
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
                            <CheckCircle className="h-4 w-4" />
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
        </CardContent>
      </Card>

      {/* Document Viewer Modal */}
      <Dialog open={documentModal.isOpen} onOpenChange={(open) => setDocumentModal({ ...documentModal, isOpen: open })}>
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
