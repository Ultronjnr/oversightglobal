import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addReimbursementComment } from "@/services/reimbursement.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reimbursementId: string | null;
  onAdded?: () => void;
}

export function AddCommentDialog({ open, onOpenChange, reimbursementId, onAdded }: Props) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reimbursementId) return;
    if (!comment.trim()) return toast.error("Comment cannot be empty");
    setSubmitting(true);
    const res = await addReimbursementComment(reimbursementId, comment.trim());
    setSubmitting(false);
    if (!res.success) return toast.error("Failed to add comment", { description: res.error });
    toast.success("Comment added");
    setComment("");
    onAdded?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" /> Add Internal Comment
          </DialogTitle>
          <DialogDescription>
            The employee will see this note on their reimbursement record.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="e.g. Please attach the original receipt — the screenshot is not legible."
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Comment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}