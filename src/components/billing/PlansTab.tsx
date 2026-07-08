import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  listPlans, getSubscription, selectPlan, cancelSubscription, saveCard,
  type SubscriptionPlan, type OrganizationSubscription, type BillingCycle,
} from "@/services/subscription.service";
import { openYocoPopup, YOCO_PUBLIC_KEY } from "@/lib/yoco";
import { toast } from "sonner";
import { Check, Star, Loader2 } from "lucide-react";

export function PlansTab() {
  const { format } = useCurrency();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [sub, setSub] = useState<OrganizationSubscription | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([listPlans(), getSubscription()]);
      setPlans(p);
      setSub(s);
      if (s?.billing_cycle) setCycle(s.billing_cycle);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const price = (p: SubscriptionPlan) => (cycle === "ANNUAL" ? p.price_annual : p.price_monthly);

  const choose = async (plan: SubscriptionPlan) => {
    if (plan.is_custom) {
      window.location.href = "mailto:sales@oversight.global?subject=Enterprise Plan Enquiry";
      return;
    }
    setBusy(plan.id);
    try {
      const amountCents = Math.round(price(plan) * 100);
      if (YOCO_PUBLIC_KEY) {
        const result = await openYocoPopup(amountCents, plan.currency);
        await saveCard(result.id, cycle, plan.id);
        toast.success(`Subscribed to ${plan.name}`);
      } else {
        // No card capture configured yet — record plan selection only
        await selectPlan(plan.id, cycle);
        toast.success(`${plan.name} selected. Add a payment card to activate billing.`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update plan");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel your subscription at the end of the current period?")) return;
    try {
      await cancelSubscription(true);
      toast.success("Subscription will cancel at period end");
      load();
    } catch { toast.error("Failed to cancel"); }
  };

  return (
    <div className="space-y-4">
      {sub && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Current status</p>
            <div className="flex items-center gap-2">
              <Badge variant={sub.status === "ACTIVE" ? "default" : sub.status === "PAST_DUE" ? "destructive" : "secondary"}>
                {sub.status}
              </Badge>
              {sub.next_billing_date && <span className="text-sm text-muted-foreground">Next billing: {sub.next_billing_date}</span>}
              {sub.cancel_at_period_end && <span className="text-sm text-destructive">Cancels at period end</span>}
            </div>
          </div>
          {sub.status !== "CANCELLED" && !sub.cancel_at_period_end && (
            <Button variant="outline" size="sm" onClick={cancel}>Cancel subscription</Button>
          )}
        </Card>
      )}

      <div className="flex items-center justify-center gap-3">
        <Label className={cycle === "MONTHLY" ? "font-semibold" : "text-muted-foreground"}>Monthly</Label>
        <Switch checked={cycle === "ANNUAL"} onCheckedChange={(v) => setCycle(v ? "ANNUAL" : "MONTHLY")} />
        <Label className={cycle === "ANNUAL" ? "font-semibold" : "text-muted-foreground"}>
          Annual <Badge variant="secondary" className="ml-1">2 months free</Badge>
        </Label>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = sub?.plan_id === p.id;
            return (
              <Card key={p.id} className={`p-5 flex flex-col relative ${p.is_recommended ? "border-primary shadow-lg ring-1 ring-primary/30" : ""}`}>
                {p.is_recommended && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1"><Star className="h-3 w-3" />Most Popular</Badge>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="text-sm text-muted-foreground min-h-10">{p.description}</p>
                <div className="my-3">
                  {p.is_custom ? (
                    <span className="text-2xl font-bold">Custom</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">{format(price(p))}</span>
                      <span className="text-muted-foreground text-sm">/{cycle === "ANNUAL" ? "year" : "month"}</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2 flex-1 mb-4">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : p.is_recommended ? "default" : "secondary"}
                  disabled={busy === p.id || isCurrent}
                  onClick={() => choose(p)}
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Current Plan" : p.is_custom ? "Contact Sales" : "Choose Plan"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
      {!YOCO_PUBLIC_KEY && (
        <p className="text-xs text-muted-foreground text-center">
          Card capture is not active yet. Choosing a plan records your selection; add your Yoco key to enable live billing.
        </p>
      )}
    </div>
  );
}
