import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Building2,
  Calendar,
  Clock,
  FileText,
  Package,
  User,
  Mail,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import type { SupplierQuoteRequest } from "@/services/supplier.service";
import { DocumentViewerModal } from "@/components/pr/DocumentViewerModal";

interface QuoteRequestDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: SupplierQuoteRequest | null;
}

export function QuoteRequestDetailsModal({
  open,
  onOpenChange,
  request,
}: QuoteRequestDetailsModalProps) {
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  if (!request) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: request.pr_currency || "ZAR",
    }).format(amount);
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "URGENT":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Urgent
          </Badge>
        );
      case "HIGH":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
            <AlertTriangle className="h-3 w-3" />
            High Priority
          </Badge>
        );
      case "LOW":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Low Priority
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Normal
          </Badge>
        );
    }
  };

  // Calculate totals
  const subtotal = (request.items || []).reduce(
    (sum, item) => sum + (item.total || item.quantity * item.unit_price || 0),
    0
  );
  const vatRate = 0.15; // 15% VAT for South Africa
  const vatAmount = subtotal * vatRate;
  const grandTotal = subtotal + vatAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Quote Request Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* PR Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">PR Code:</span>
                <span className="font-mono font-semibold text-primary">
                  {request.pr_transaction_id}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Organization:</span>
                <span className="font-medium">{request.organization_name}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">Requested By:</span>
                <div>
                  <p className="font-medium">{request.requester_name || "—"}</p>
                  {request.requester_email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {request.requester_email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Urgency:</span>
                {getUrgencyBadge(request.pr_urgency || "NORMAL")}
              </div>
              {request.pr_due_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">
                    {format(new Date(request.pr_due_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {request.pr_payment_due_date && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Payment Due:</span>
                  <span className="font-medium">
                    {format(new Date(request.pr_payment_due_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Requested:</span>
                <span className="font-medium">
                  {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            </div>
          </div>

          {/* Message from Finance (if any) */}
          {request.message && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-primary mb-1">Message from Requester:</p>
              <p className="text-sm text-foreground">{request.message}</p>
            </div>
          )}

          {/* Line Items Table */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Line Items
            </h3>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(request.items || []).map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell className="font-medium">
                        {item.description}
                        {item.supplier_preference && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Preferred: {item.supplier_preference}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(item.total || item.quantity * item.unit_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT (15%):</span>
                  <span className="font-mono">{formatCurrency(vatAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Grand Total:</span>
                  <span className="font-mono text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attached Document */}
          {request.pr_document_url && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Attached Document
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowDocumentModal(true)}
              >
                <FileText className="h-4 w-4" />
                View Document
              </Button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Document Viewer Modal */}
      {request.pr_document_url && (
        <DocumentViewerModal
          isOpen={showDocumentModal}
          onClose={() => setShowDocumentModal(false)}
          documentUrl={request.pr_document_url}
          prId={request.pr_id}
          transactionId={request.pr_transaction_id}
        />
      )}
    </Dialog>
  );
}
