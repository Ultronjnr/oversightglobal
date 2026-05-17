import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  submitReimbursement,
  getMyRequisitionsForLinking,
  REIMBURSEMENT_PAYMENT_METHODS,
} from "@/services/reimbursement.service";
import { DocumentCaptureField } from "@/components/capture/DocumentCaptureField";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
  /** Optional file to preload as the receipt/proof (e.g. from a global scan). */
  initialFile?: File | null;
}

const NONE_VALUE = "__none__";

export function SubmitStandaloneReimbursementModal({
  open,
  onOpenChange,
  onSubmitted,
  initialFile = null,
}: Props) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("EFT");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [prId, setPrId] = useState<string>(NONE_VALUE);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prs, setPrs] = useState<
    Array<{ id: string; transaction_id: string; total_amount: number; currency: string }>
  >([]);

  useEffect(() => {
    if (!open) return;
    getMyRequisitionsForLinking().then(setPrs);
  }, [open]);

  // Preload an externally-captured file (e.g. from the global Scan FAB).
  useEffect(() => {
    if (open && initialFile) setFile(initialFile);
  }, [open, initialFile]);

  const reset = () => {
    setTitle("");
    setAmount("");
    setMethod("EFT");
    setReference("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setDescription("");
    setPrId(NONE_VALUE);
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return toast.error("Enter a valid amount");
    if (!description.trim()) return toast.error("Please add a description");
    if (!file) return toast.error("Receipt / proof of payment is required");

    setSubmitting(true);
    const res = await submitReimbursement({
      title: title.trim(),
      amount: numAmount,
      description: description.trim(),
      payment_method: method,
      pr_id: prId === NONE_VALUE ? null : prId,
      reference: reference.trim() || undefined,
      reimbursement_date: date,
      proof_file: file,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      toast.error("Failed to submit reimbursement", { description: res.error });
      return;
    }
    toast.success("Reimbursement submitted", {
      description: "Finance will review your request.",
    });
    reset();
    onSubmitted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Reimbursement</DialogTitle>
          <DialogDescription>
            Get reimbursed for an out-of-pocket business expense. Optionally link it to a
            purchase requisition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Client lunch — Sandton"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Link to Requisition (optional)</Label>
            <Select value={prId} onValueChange={setPrId}>
              <SelectTrigger>
                <SelectValue placeholder="No linked requisition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>No linked requisition</SelectItem>
                {prs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.transaction_id} — {p.currency} {Number(p.total_amount).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (ZAR) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REIMBURSEMENT_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. txn-12345"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expense Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="What was this expense for?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra context for Finance"
              rows={2}
              maxLength={1000}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Receipt / Proof of Payment *</Label>
            <DocumentCaptureField
              file={file}
              onChange={setFile}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              maxSizeMB={10}
              helperText="PDF, JPG, PNG (max 10MB)"
              fileNamePrefix="reimbursement-proof"
              onError={(m) => toast.error(m)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Reimbursement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}