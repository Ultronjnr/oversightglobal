import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getPaymentMethod, getSubscription, saveCard, removePaymentMethod,
  type PaymentMethod, type OrganizationSubscription,
} from "@/services/subscription.service";
import { openYocoPopup, YOCO_PUBLIC_KEY } from "@/lib/yoco";
import { toast } from "sonner";
import { CreditCard, Loader2, Trash2, ShieldCheck } from "lucide-react";

export function PaymentMethodTab() {
  const [card, setCard] = useState<PaymentMethod | null>(null);
  const [sub, setSub] = useState<OrganizationSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([getPaymentMethod(), getSubscription()]);
      setCard(c); setSub(s);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addCard = async () => {
    if (!YOCO_PUBLIC_KEY) {
      toast.error("Yoco is not configured yet. Add your Yoco public key to capture cards.");
      return;
    }
    setBusy(true);
    try {
      const result = await openYocoPopup(100, "ZAR"); // R1 verification-style tokenization
      await saveCard(result.id, sub?.billing_cycle ?? "MONTHLY", sub?.plan_id ?? null);
      toast.success("Card saved securely");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save card");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!card) return;
    if (!confirm("Remove this card? Automatic billing will stop until a new card is added.")) return;
    try {
      await removePaymentMethod(card.id);
      toast.success("Card removed");
      load();
    } catch { toast.error("Failed to remove card"); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 max-w-lg">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="font-semibold">Stored Card (Vault)</p>
        </div>
        {card ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{card.brand || "Card"} •••• {card.last4 || "----"}</p>
                {card.expiry_month && (
                  <p className="text-sm text-muted-foreground">
                    Expires {String(card.expiry_month).padStart(2, "0")}/{card.expiry_year}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No card on file. Add one to enable automatic monthly billing.</p>
        )}
        <Button className="mt-4 w-full" onClick={addCard} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : card ? "Replace Card" : "Add Card"}
        </Button>
      </Card>
      <p className="text-xs text-muted-foreground">
        Card details are tokenized and stored securely by Yoco. We never store full card numbers.
      </p>
    </div>
  );
}
