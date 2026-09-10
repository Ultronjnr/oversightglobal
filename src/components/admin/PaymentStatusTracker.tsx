import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Layers, CheckCheck, AlertCircle, ArrowRight } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  getPaymentBuckets,
  type PaymentBucketKey,
  type PaymentBuckets,
} from "@/services/payment-status.service";
import { cn } from "@/lib/utils";

interface Props {
  /** Called with the workspace tab to open when a bucket is chosen. */
  onOpenTab?: (tab: string) => void;
  /** Information only — no next actions, used where the person cannot pay. */
  readOnly?: boolean;
}

const META: Record<
  PaymentBucketKey,
  { label: string; action: string; tab: string; tone: string; icon: React.ElementType }
> = {
  APPROVED_NOT_PAID: {
    label: "Approved – Not Paid",
    action: "Add to a payment batch",
    tab: "payments",
    tone: "bg-primary/10 text-primary border-primary/20",
    icon: Wallet,
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    action: "Settle the balance",
    tab: "partially_paid",
    tone: "bg-warning/10 text-warning border-warning/20",
    icon: Layers,
  },
  FULLY_PAID: {
    label: "Fully Paid",
    action: "Review and file",
    tab: "fully_paid",
    tone: "bg-success/10 text-success border-success/20",
    icon: CheckCheck,
  },
  OVERDUE: {
    label: "Overdue (30+ days)",
    action: "Pay urgently",
    tab: "overdue",
    tone: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertCircle,
  },
};

const ORDER: PaymentBucketKey[] = [
  "APPROVED_NOT_PAID",
  "PARTIALLY_PAID",
  "FULLY_PAID",
  "OVERDUE",
];

export function PaymentStatusTracker({ onOpenTab, readOnly }: Props) {
  const { format } = useCurrency();
  const [buckets, setBuckets] = useState<PaymentBuckets | null>(null);

  useEffect(() => {
    let active = true;
    getPaymentBuckets().then((b) => {
      if (active) setBuckets(b);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payment status</CardTitle>
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Where every approved amount currently sits."
            : "Where every approved amount currently sits, and what to do next."}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((key) => {
          const meta = META[key];
          const Icon = meta.icon;
          const bucket = buckets?.[key];
          return (
            <button
              key={key}
              type="button"
              disabled={readOnly}
              onClick={() => onOpenTab?.(meta.tab)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                !readOnly && "hover:-translate-y-0.5 hover:shadow-md",
                meta.tone,
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{meta.label}</span>
              </div>
              {!buckets ? (
                <Skeleton className="h-7 w-24 mt-2" />
              ) : (
                <>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
                    {format(bucket?.total ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bucket?.count ?? 0} item{(bucket?.count ?? 0) === 1 ? "" : "s"}
                  </p>
                </>
              )}
              {!readOnly && (
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium">
                  {meta.action} <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
