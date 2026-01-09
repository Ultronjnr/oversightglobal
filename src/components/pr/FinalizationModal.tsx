import { useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import type { PurchaseRequisition } from "@/types/pr.types";

interface FinalizationModalProps {
  pr: PurchaseRequisition | null;
  action: "approve" | "decline" | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (prId: string, action: "approve" | "decline", comments: string) => Promise<void>;
}

export function FinalizationModal({
  pr,
  action,
  open,
  onClose,
  onConfirm,
}: FinalizationModalProps) {
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!pr || !action) return;

    if (!comments.trim()) {
      toast.error("Please provide comments");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(pr.id, action, comments);
      setComments("");
      onClose();
    } catch (error) {
      console.error("Finalization error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setComments("");
      onClose();
    }
  };

  if (!pr || !action) return null;

  const isApprove = action === "approve";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {isApprove ? "Approve" : "Decline"} Purchase Requisition
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? "This PR will be forwarded to Finance for final approval."
              : "This PR will be returned to the employee with your feedback."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* PR Summary */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1">
            <p className="text-sm font-medium">{pr.transaction_id}</p>
            <p className="text-sm text-muted-foreground">
              {pr.requested_by_name} • {pr.requested_by_department}
            </p>
            <p className="text-sm font-semibold text-primary">
              {pr.currency} {pr.total_amount.toLocaleString()}
            </p>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label htmlFor="comments">
              Comments <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="comments"
              placeholder={
                isApprove
                  ? "Enter approval comments..."
                  : "Enter reason for declining..."
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="bg-background/50"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={isSubmitting || !comments.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : isApprove ? (
              "Approve & Forward"
            ) : (
              "Decline & Return"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
