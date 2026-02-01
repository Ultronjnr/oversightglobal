import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitQuote, type SupplierQuoteRequest } from "@/services/supplier.service";
import { uploadQuoteDocument } from "@/services/quote-document.service";
import { Send, DollarSign, Truck, Calendar, FileUp, X, Loader2, FileText } from "lucide-react";
import { format, addDays } from "date-fns";

interface SubmitQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequest: SupplierQuoteRequest | null;
  onSuccess: () => void;
}

export function SubmitQuoteModal({
  open,
  onOpenChange,
  quoteRequest,
  onSuccess,
}: SubmitQuoteModalProps) {
  const [amount, setAmount] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [validUntil, setValidUntil] = useState(
    format(addDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate PDF
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quoteRequest) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      let documentUrl: string | undefined;

      // Upload document if selected
      if (selectedFile) {
        setIsUploading(true);
        const uploadResult = await uploadQuoteDocument(selectedFile, quoteRequest.id);
        setIsUploading(false);

        if (!uploadResult.success) {
          toast.error(uploadResult.error || "Failed to upload document");
          setIsSubmitting(false);
          return;
        }
        documentUrl = uploadResult.path;
      }

      const result = await submitQuote({
        quoteRequestId: quoteRequest.id,
        prId: quoteRequest.pr_id,
        organizationId: quoteRequest.organization_id,
        amount: parsedAmount,
        deliveryTime: deliveryTime || undefined,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        documentUrl,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to submit quote");
        return;
      }

      toast.success("Quote submitted successfully!");
      onSuccess();
      resetForm();
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setDeliveryTime("");
    setValidUntil(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    setNotes("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const calculateTotalFromItems = () => {
    if (!quoteRequest?.items) return 0;
    return quoteRequest.items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Submit Quote
          </DialogTitle>
          <DialogDescription>
            Provide your pricing and delivery details for this quote request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Items Summary */}
          {quoteRequest?.items && quoteRequest.items.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">Requested Items:</p>
              <div className="space-y-1">
                {quoteRequest.items.map((item, idx) => (
                  <div key={idx} className="text-sm flex justify-between">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.description}
                    </span>
                    <span className="font-mono">
                      {new Intl.NumberFormat("en-ZA", {
                        style: "currency",
                        currency: "ZAR",
                      }).format(item.total || 0)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between text-sm">
                <span className="font-medium">Estimated Total:</span>
                <span className="font-mono font-semibold">
                  {new Intl.NumberFormat("en-ZA", {
                    style: "currency",
                    currency: "ZAR",
                  }).format(calculateTotalFromItems())}
                </span>
              </div>
            </div>
          )}

          {/* Message from requester */}
          {quoteRequest?.message && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium mb-1">Message from requester:</p>
              <p className="text-sm text-muted-foreground">{quoteRequest.message}</p>
            </div>
          )}

          {/* Quote Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Your Quote Amount (ZAR) *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter your quoted price"
                className="pl-10"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Delivery Time */}
          <div className="space-y-2">
            <Label htmlFor="deliveryTime">Estimated Delivery Date *</Label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="deliveryTime"
                type="text"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                placeholder="e.g., 5-7 business days"
                className="pl-10"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Valid Until */}
          <div className="space-y-2">
            <Label htmlFor="validUntil">Quote Valid Until *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="pl-10"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Quote Document Upload */}
          <div className="space-y-2">
            <Label>Quote Document (PDF)</Label>
            <div className="border-2 border-dashed border-border/50 rounded-lg p-4">
              {selectedFile ? (
                <div className="flex items-center justify-between bg-muted/50 rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer py-4">
                  <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to upload PDF</p>
                  <p className="text-xs text-muted-foreground">Max 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional terms, conditions, or information..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isUploading ? "Uploading..." : "Submitting..."}
                </>
              ) : (
                "Submit Quote"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
