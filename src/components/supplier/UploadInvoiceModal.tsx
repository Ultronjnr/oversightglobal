import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, FileText, Upload, CheckCircle, DollarSign } from "lucide-react";
import { uploadInvoice } from "@/services/invoice.service";
import type { SupplierQuote } from "@/services/supplier.service";
import { format } from "date-fns";

interface UploadInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: SupplierQuote | null;
  onSuccess: () => void;
}

export function UploadInvoiceModal({
  open,
  onOpenChange,
  quote,
  onSuccess,
}: UploadInvoiceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Only PDF files are allowed");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!quote || !selectedFile) {
      toast.error("Please select a PDF file");
      return;
    }

    setIsLoading(true);
    try {
      const result = await uploadInvoice(
        selectedFile,
        quote.id,
        quote.pr_id,
        quote.organization_id
      );

      if (result.success) {
        toast.success("Invoice uploaded successfully!");
        onSuccess();
        handleClose();
      } else {
        toast.error(result.error || "Failed to upload invoice");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Upload Invoice
          </DialogTitle>
          <DialogDescription>
            Upload your official invoice for the accepted quote.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quote Summary */}
          <div className="bg-success/10 border border-success/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="font-medium text-success">Quote Accepted</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Amount</span>
                <p className="font-semibold text-lg text-primary">
                  {formatCurrency(quote.amount)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Delivery</span>
                <p className="font-medium">{quote.delivery_time || "Not specified"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Quote Date</span>
                <p className="font-medium">
                  {format(new Date(quote.created_at), "dd MMM yyyy")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <Badge className="bg-success/20 text-success border-success/30 mt-1">
                  Accepted
                </Badge>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="invoice-file" className="text-sm font-medium">
              Invoice Document (PDF only) *
            </Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Input
                id="invoice-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Label
                htmlFor="invoice-file"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="p-3 rounded-full bg-muted">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="font-medium text-primary">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium">Click to upload invoice</p>
                    <p className="text-xs text-muted-foreground">
                      PDF only, max 10MB
                    </p>
                  </div>
                )}
              </Label>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Once submitted, your invoice will be reviewed by the Finance team.
              Payment will be processed according to the agreed terms.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !selectedFile}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
