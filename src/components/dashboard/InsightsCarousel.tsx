import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, FileWarning, TrendingUp, Target, Wallet } from "lucide-react";

interface Insights {
  vatIssues: number;
  expenditure: number;
  missingDocs: number;
  onTrackPct: number;
  outstanding: number;
}

/**
 * Sliding analytics cards shown at the top of each portal dashboard.
 * Scoped to the signed-in user's organisation (RLS enforces this too).
 */
export function InsightsCarousel() {
  const { profile } = useAuth();
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data: txns } = await supabase
        .from("transactions")
        .select("amount, amount_paid, status, vat_amount, vat_rate, document_url, scan_document_path, created_at")
        .gte("created_at", since.toISOString())
        .limit(1000);

      if (cancelled) return;

      const rows = txns || [];
      const expenditure = rows.reduce((s, t) => s + Number(t.amount || 0), 0);
      const paid = rows.reduce((s, t) => s + Number(t.amount_paid || 0), 0);
      const vatIssues = rows.filter(
        (t) => Number(t.vat_rate) > 0 && !Number(t.vat_amount),
      ).length;
      const missingDocs = rows.filter((t) => !t.document_url && !t.scan_document_path).length;
      const onTrackPct = expenditure > 0 ? Math.round((paid / expenditure) * 100) : 0;

      setData({
        vatIssues,
        expenditure,
        missingDocs,
        onTrackPct,
        outstanding: Math.max(expenditure - paid, 0),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organization_id]);

  const cards = [
    {
      label: "VAT issues to review",
      value: data ? String(data.vatIssues) : "0",
      color: (data?.vatIssues ? "destructive" : "success") as const,
      icon: <AlertTriangle className="h-4 w-4" />,
      footer: "Transactions with a VAT rate but no VAT captured",
    },
    {
      label: "Expenditure (90 days)",
      value: formatCurrency(data?.expenditure || 0),
      color: "primary" as const,
      icon: <TrendingUp className="h-4 w-4" />,
      footer: "Total approved transaction value",
    },
    {
      label: "Missing documentation",
      value: data ? String(data.missingDocs) : "0",
      color: (data?.missingDocs ? "warning" : "success") as const,
      icon: <FileWarning className="h-4 w-4" />,
      footer: "Transactions without an invoice or receipt attached",
    },
    {
      label: "On-track spend",
      value: `${data?.onTrackPct || 0}%`,
      color: "success" as const,
      icon: <Target className="h-4 w-4" />,
      footer: "Share of approved spend already settled",
    },
    {
      label: "Outstanding to pay",
      value: formatCurrency(data?.outstanding || 0),
      color: "warning" as const,
      icon: <Wallet className="h-4 w-4" />,
      footer: "Approved value not yet paid out",
    },
  ];

  return (
    <Carousel opts={{ align: "start", loop: true }} className="mb-5 sm:mb-7">
      <CarouselContent className="-ml-3">
        {cards.map((c) => (
          <CarouselItem key={c.label} className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
            <StatCard
              label={c.label}
              value={c.value}
              valueColor={c.color}
              icon={c.icon}
              isLoading={loading}
              footer={<span className="text-xs text-muted-foreground">{c.footer}</span>}
              className="h-full"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex -left-3" />
      <CarouselNext className="hidden sm:flex -right-3" />
    </Carousel>
  );
}
