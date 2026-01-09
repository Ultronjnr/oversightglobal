import { useState } from "react";
import { Loader2, Scissors, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { PurchaseRequisition, PRItem } from "@/types/pr.types";

interface SplitGroup {
  id: string;
  items: PRItem[];
  comments: string;
}

interface SplitPRModalProps {
  pr: PurchaseRequisition | null;
  open: boolean;
  onClose: () => void;
  onConfirm?: (prId: string, splits: { items: PRItem[]; comments: string }[]) => Promise<void>;
  onSuccess?: () => void;
  role?: "HOD" | "FINANCE";
}

export function SplitPRModal({ pr, open, onClose, onConfirm, onSuccess, role = "HOD" }: SplitPRModalProps) {
  const [splits, setSplits] = useState<SplitGroup[]>([
    { id: uuidv4(), items: [], comments: "" },
    { id: uuidv4(), items: [], comments: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prItems = pr ? (pr.items as PRItem[]) : [];

  const getAssignedItems = (): Set<string> => {
    const assigned = new Set<string>();
    splits.forEach((split) => {
      split.items.forEach((item) => assigned.add(item.id));
    });
    return assigned;
  };

  const toggleItemInSplit = (splitIndex: number, item: PRItem) => {
    setSplits((prev) =>
      prev.map((split, idx) => {
        if (idx !== splitIndex) {
          // Remove from other splits if exists
          return {
            ...split,
            items: split.items.filter((i) => i.id !== item.id),
          };
        }
        // Toggle in current split
        const exists = split.items.find((i) => i.id === item.id);
        if (exists) {
          return {
            ...split,
            items: split.items.filter((i) => i.id !== item.id),
          };
        }
        return {
          ...split,
          items: [...split.items, item],
        };
      })
    );
  };

  const updateSplitComments = (splitIndex: number, comments: string) => {
    setSplits((prev) =>
      prev.map((split, idx) =>
        idx === splitIndex ? { ...split, comments } : split
      )
    );
  };

  const addSplit = () => {
    setSplits((prev) => [...prev, { id: uuidv4(), items: [], comments: "" }]);
  };

  const removeSplit = (splitIndex: number) => {
    if (splits.length <= 2) {
      toast.error("Minimum 2 splits required");
      return;
    }
    setSplits((prev) => prev.filter((_, idx) => idx !== splitIndex));
  };

  const calculateSplitTotal = (items: PRItem[]): number => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleConfirm = async () => {
    if (!pr) return;

    // Validate all items are assigned
    const assignedItems = getAssignedItems();
    const allAssigned = prItems.every((item) => assignedItems.has(item.id));

    if (!allAssigned) {
      toast.error("All items must be assigned to a split");
      return;
    }

    // Validate each split has items
    const validSplits = splits.filter((s) => s.items.length > 0);
    if (validSplits.length < 2) {
      toast.error("At least 2 splits must have items");
      return;
    }

    // Validate comments
    const missingComments = validSplits.some((s) => !s.comments.trim());
    if (missingComments) {
      toast.error("Please provide comments for each split");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(
        pr.id,
        validSplits.map((s) => ({ items: s.items, comments: s.comments }))
      );
      onClose();
    } catch (error) {
      console.error("Split error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSplits([
        { id: uuidv4(), items: [], comments: "" },
        { id: uuidv4(), items: [], comments: "" },
      ]);
      onClose();
    }
  };

  if (!pr) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Split Purchase Requisition
          </DialogTitle>
          <DialogDescription>
            Divide {pr.transaction_id} into multiple smaller PRs. Each split will be
            forwarded to Finance separately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Original PR Summary */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{pr.transaction_id}</span>
              <span className="font-semibold text-primary">
                {pr.currency} {pr.total_amount.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {prItems.length} items • {pr.requested_by_name}
            </p>
          </div>

          {/* Splits */}
          <div className="space-y-4">
            {splits.map((split, splitIndex) => (
              <div
                key={split.id}
                className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Split {splitIndex + 1}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {pr.currency} {calculateSplitTotal(split.items).toLocaleString()}
                    </span>
                    {splits.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeSplit(splitIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Item Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Select Items</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {prItems.map((item) => {
                      const isInThisSplit = split.items.some((i) => i.id === item.id);
                      const isInOtherSplit = splits.some(
                        (s, idx) =>
                          idx !== splitIndex && s.items.some((i) => i.id === item.id)
                      );

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border ${
                            isInThisSplit
                              ? "border-primary/50 bg-primary/5"
                              : isInOtherSplit
                              ? "border-border/30 bg-muted/20 opacity-50"
                              : "border-border/50"
                          }`}
                        >
                          <Checkbox
                            checked={isInThisSplit}
                            disabled={isInOtherSplit}
                            onCheckedChange={() => toggleItemInSplit(splitIndex, item)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} × R {item.unit_price.toFixed(2)}
                            </p>
                          </div>
                          <span className="text-sm font-medium">
                            R {item.total.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label className="text-sm">Comments</Label>
                  <Input
                    placeholder="Reason for this split..."
                    value={split.comments}
                    onChange={(e) => updateSplitComments(splitIndex, e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add Split Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addSplit}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Split
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Splitting...
              </>
            ) : (
              "Confirm Split"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
