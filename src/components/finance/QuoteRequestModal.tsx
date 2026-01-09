import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { sendQuoteRequest, getVerifiedSuppliers, type Supplier } from "@/services/finance.service";
import type { PurchaseRequisition, PRItem } from "@/types/pr.types";

interface QuoteRequestModalProps {
  open: boolean;
  onClose: () => void;
  pr: PurchaseRequisition;
  onSuccess: () => void;
}

export function QuoteRequestModal({
  open,
  onClose,
  pr,
  onSuccess,
}: QuoteRequestModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuppliers, setIsFetchingSuppliers] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      // Select all items by default
      setSelectedItems(new Set(pr.items.map((item) => item.id)));
    }
  }, [open, pr.items]);

  const fetchSuppliers = async () => {
    setIsFetchingSuppliers(true);
    try {
      const result = await getVerifiedSuppliers();
      if (result.success) {
        setSuppliers(result.data);
      } else {
        toast.error("Failed to load suppliers");
      }
    } finally {
      setIsFetchingSuppliers(false);
    }
  };

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      toast.error("Please select a supplier");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setIsLoading(true);
    try {
      const selectedItemsList = pr.items.filter((item) =>
        selectedItems.has(item.id)
      );

      const result = await sendQuoteRequest(
        pr.id,
        selectedSupplier,
        selectedItemsList,
        message
      );

      if (result.success) {
        toast.success("Quote request sent successfully");
        onSuccess();
        onClose();
        resetForm();
      } else {
        toast.error(result.error || "Failed to send quote request");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedSupplier("");
    setSelectedItems(new Set());
    setMessage("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: pr.currency || "ZAR",
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Quote Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* PR Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              PR: <span className="font-medium text-foreground">{pr.transaction_id}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-medium text-foreground">{formatCurrency(pr.total_amount)}</span>
            </p>
          </div>

          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label>Select Supplier</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger>
                <SelectValue placeholder={isFetchingSuppliers ? "Loading suppliers..." : "Choose a supplier"} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.company_name}
                    {supplier.industry && (
                      <span className="text-muted-foreground ml-2">
                        ({supplier.industry})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suppliers.length === 0 && !isFetchingSuppliers && (
              <p className="text-sm text-muted-foreground">
                No verified suppliers available
              </p>
            )}
          </div>

          {/* Items Selection */}
          <div className="space-y-2">
            <Label>Select Items to Include</Label>
            <div className="border rounded-lg divide-y">
              {pr.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedItems.has(item.id)}
                    onCheckedChange={() => handleItemToggle(item.id)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatCurrency(item.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message to Supplier (Optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add any special requirements or notes for the supplier..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
