import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { PRItem, PurchaseRequisition, UrgencyLevel } from "@/types/pr.types";

interface Props {
  pr: PurchaseRequisition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const URGENCIES: UrgencyLevel[] = ["LOW", "NORMAL", "HIGH", "URGENT"] as UrgencyLevel[];

export function HODEditPRModal({ pr, open, onOpenChange, onSaved }: Props) {
  const [items, setItems] = useState<PRItem[]>([]);
  const [paymentDue, setPaymentDue] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("NORMAL" as UrgencyLevel);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pr && open) {
      setItems((pr.items || []).map((i) => ({ ...i })));
      setPaymentDue(pr.payment_due_date ? pr.payment_due_date.slice(0, 10) : "");
      setUrgency(pr.urgency);
      setNote("");
    }
  }, [pr, open]);

  const update = (idx: number, patch: Partial<PRItem>) =>
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.total = Math.round(Number(next.quantity || 0) * Number(next.unit_price || 0) * 100) / 100;
        return next;
      }),
    );

  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const save = async () => {
    if (!pr) return;
    if (items.length === 0 || items.some((i) => !i.description.trim() || i.quantity <= 0)) {
      toast.error("Each item needs a description and a quantity above 0.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const history = [
      ...(pr.history || []),
      {
        action: "HOD_EDITED",
        user_id: user?.id || "",
        user_name: "HOD",
        timestamp: new Date().toISOString(),
        details: note || "Requisition edited by HOD",
      } as any,
    ];
    const { error } = await supabase
      .from("purchase_requisitions" as any)
      .update({
        items,
        total_amount: Math.round(total * 100) / 100,
        payment_due_date: paymentDue || null,
        urgency,
        history,
      } as any)
      .eq("id", pr.id);
    setSaving(false);
    if (error) {
      toast.error(`Could not save changes: ${error.message}`);
      return;
    }
    toast.success("Requisition updated");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {pr?.transaction_id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Line items</Label>
            {items.map((item, idx) => (
              <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-start">
                <Textarea
                  className="col-span-6 min-h-[40px]"
                  value={item.description}
                  onChange={(e) => update(idx, { description: e.target.value })}
                  placeholder="Description / reason"
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => update(idx, { unit_price: Number(e.target.value) })}
                />
                <div className="col-span-1 text-right text-sm font-medium pt-2 whitespace-nowrap">
                  {formatCurrency(item.total, pr?.currency)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="col-span-1 text-destructive"
                  onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((p) => [
                  ...p,
                  { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, total: 0 },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add item
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Payment due date</Label>
              <Input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Urgency</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
              >
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>{u.charAt(0) + u.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Reason for edit (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Corrected unit price" />
          </div>

          <div className="flex justify-end text-sm">
            <span className="text-muted-foreground mr-2">New total:</span>
            <span className="font-semibold text-primary whitespace-nowrap">
              {formatCurrency(total, pr?.currency)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
