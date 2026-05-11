import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  submitReimbursementForPR,
  REIMBURSEMENT_PAYMENT_METHODS,
} from "@/services/reimbursement.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prId: string;
  prTotal: number;
  prTransactionId: string;
  onSubmitted?: () => void;
}

export function SubmitReimbursementModal({
  open,
  onOpenChange,
  prId,
  prTotal,
  prTransactionId,
  onSubmitted,
}: Props) {
  const [amount, setAmount] = useState<string>(prTotal.toFixed(2));
  const [method, setMethod] = useState<string>("EFT");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (numAmount > prTotal) {
      toast.error("Amount cannot exceed the requisition total", {
        description: `Max: ZAR ${prTotal.toFixed(2)}`,
      });
      return;
    }
    if (!file) {
      toast.error("Proof of payment is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Please add a short description");
      return;
    }

    setSubmitting(true);
    const result = await submitReimbursementForPR({
      pr_id: prId,
      amount: numAmount,
      description: description.trim(),
      payment_method: method,
      reference: reference.trim() || undefined,
      reimbursement_date: date,
      proof_file: file,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error("Failed to submit reimbursement", { description: result.error });
      return;
    }
    toast.success("Reimbursement submitted", {
      description: "Finance will review your request.",
    });
    onSubmitted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Reimbursement</DialogTitle>
          <DialogDescription>
            Linked to requisition <span className="font-mono">{prTransactionId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (ZAR) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Max: ZAR {prTotal.toFixed(2)}
              </p>
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
              <Label>Date Paid</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this expense for?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context for Finance"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Proof of Payment *</Label>
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <FileText className="h-5 w-5 text-primary" />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Upload receipt or proof</span>
                <span className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG (max 10MB)</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 10 * 1024 * 1024) {
                      toast.error("File too large (max 10MB)");
                      return;
                    }
                    setFile(f || null);
                  }}
                />
              </label>
            )}
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