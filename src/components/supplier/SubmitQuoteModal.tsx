import { useState, useRef, useEffect } from "react";
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
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitQuote, type SupplierQuoteRequest } from "@/services/supplier.service";
import { uploadQuoteDocument } from "@/services/quote-document.service";
import { Send, Wallet, Truck, Calendar as CalendarIcon, FileUp, X, Loader2, FileText, Handshake } from "lucide-react";
import { format, addDays } from "date-fns";
import { formatCurrency } from "@/lib/utils";

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
  const quoteCurrency = quoteRequest?.pr_currency || "ZAR";
  const [amount, setAmount] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [validUntilOpen, setValidUntilOpen] = useState(false);
  const [validUntil, setValidUntil] = useState(
    format(addDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [validUntilDate, setValidUntilDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-item revised pricing (counter-price the buyer's requested items)
  const [reviseItems, setReviseItems] = useState(false);
  const [itemPrices, setItemPrices] = useState<Array<{ description: string; quantity: number; unit_price: number; total: number }>>([]);

  // Initialize per-item prices whenever the request changes
  useEffect(() => {
    if (quoteRequest?.items?.length) {
      setItemPrices(
        quoteRequest.items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          total: Number(it.total) || 0,
        }))
      );
    } else {
      setItemPrices([]);
    }
    setReviseItems(false);
  }, [quoteRequest?.id]);

  const handleItemPriceChange = (index: number, unitPrice: number) => {
    setItemPrices((prev) => {
      const next = [...prev];
      const qty = next[index].quantity || 0;
      next[index] = { ...next[index], unit_price: unitPrice, total: qty * unitPrice };
      return next;
    });
  };

  const revisedTotal = itemPrices.reduce((sum, it) => sum + (it.total || 0), 0);

  // When toggling revise on, auto-fill the amount from the revised total
  useEffect(() => {
    if (reviseItems && itemPrices.length > 0) {
      setAmount(revisedTotal > 0 ? revisedTotal.toFixed(2) : "");
    }
  }, [reviseItems, revisedTotal, itemPrices.length]);

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

    if (!deliveryDate) {
      toast.error("Please pick an estimated delivery date");
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
        deliveryTime: deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : undefined,
        validUntil: validUntilDate ? format(validUntilDate, "yyyy-MM-dd") : validUntil || undefined,
        notes: notes || undefined,
        documentUrl,
        itemPrices: reviseItems ? itemPrices : undefined,
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
    setDeliveryDate(undefined);
    setValidUntil(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    setValidUntilDate(addDays(new Date(), 30));
    setNotes("");
    setSelectedFile(null);
    setReviseItems(false);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
          {/* Items Summary + Per-item pricing toggle */}
          {quoteRequest?.items && quoteRequest.items.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-primary" />
                  Requested Items
                </p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="revise-items" className="text-xs text-muted-foreground cursor-pointer">
                    Propose your price per item
                  </Label>
                  <Switch
                    id="revise-items"
                    checked={reviseItems}
                    onCheckedChange={setReviseItems}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {!reviseItems ? (
                <>
                  <div className="space-y-1">
                    {quoteRequest.items.map((item, idx) => (
                      <div key={idx} className="text-sm flex justify-between">
                        <span className="text-muted-foreground">
                          {item.quantity}× {item.description}
                        </span>
                        <span className="font-mono">
                          {formatCurrency(item.total || 0, quoteCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm">
                    <span className="font-medium">Buyer's Estimated Total:</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(calculateTotalFromItems(), quoteCurrency)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    {itemPrices.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-background/60 rounded-md p-2 border border-border/40">
                        <div className="col-span-6 text-xs">
                          <p className="font-medium truncate">{it.description}</p>
                          <p className="text-muted-foreground">Qty: {it.quantity}</p>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.unit_price === 0 ? "" : it.unit_price}
                            onChange={(e) => handleItemPriceChange(idx, parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-8 text-sm"
                            disabled={isSubmitting}
                            aria-label={`Unit price for ${it.description}`}
                          />
                        </div>
                        <div className="col-span-3 text-right font-mono text-sm">
                          {formatCurrency(it.total, quoteCurrency)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm">
                    <span className="font-medium">Your Revised Total:</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatCurrency(revisedTotal, quoteCurrency)}
                    </span>
                  </div>
                </>
              )}
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
            <Label htmlFor="amount">Your Quote Amount ({quoteCurrency}) *</Label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                disabled={isSubmitting || reviseItems}
              />
            </div>
            {reviseItems && (
              <p className="text-xs text-muted-foreground">
                Total is auto-calculated from your per-item pricing.
              </p>
            )}
          </div>

          {/* Estimated Delivery Date (calendar) */}
          <div className="space-y-2">
            <Label>Estimated Delivery Date *</Label>
            <Popover open={deliveryOpen} onOpenChange={setDeliveryOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !deliveryDate && "text-muted-foreground"
                  )}
                  disabled={isSubmitting}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  {deliveryDate ? format(deliveryDate, "PPP") : <span>Pick a delivery date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={deliveryDate}
                  onSelect={(d) => {
                    setDeliveryDate(d);
                    if (d) setDeliveryOpen(false);
                  }}
                  initialFocus
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Valid Until */}
          <div className="space-y-2">
            <Label>Quote Valid Until *</Label>
            <Popover open={validUntilOpen} onOpenChange={setValidUntilOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !validUntilDate && "text-muted-foreground"
                  )}
                  disabled={isSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {validUntilDate ? format(validUntilDate, "PPP") : <span>Pick a validity date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={validUntilDate}
                  onSelect={(d) => {
                    setValidUntilDate(d);
                    if (d) setValidUntil(format(d, "yyyy-MM-dd"));
                    if (d) setValidUntilOpen(false);
                  }}
                  initialFocus
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
