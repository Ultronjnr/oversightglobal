import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { formatCurrency, cn } from "@/lib/utils";
import {
  AlertTriangle,
  FileWarning,
  TrendingUp,
  Target,
  Wallet,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";

interface Insights {
  vatIssues: number;
  vatUnassessed: number;
  expenditure: number;
  paid: number;
  missingDocs: number;
  onTrackPct: number;
  outstanding: number;
  txnCount: number;
  unpaidCount: number;
}

type CardColor = "default" | "success" | "warning" | "destructive" | "primary";

interface InsightCard {
  key: string;
  label: string;
  value: string;
  color: CardColor;
  icon: JSX.Element;
  /** Layer 2 – supporting detail, revealed on demand. */
  detail: { label: string; value: string }[];
  explainer: string;
  href?: string;
  hrefLabel?: string;
}

const colorClasses: Record<CardColor, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  primary: "text-primary",
};

/**
 * Sliding analytics cards shown at the top of each portal dashboard.
 *
 * Two layers of information only:
 *   layer 1 – the headline number (always visible)
 *   layer 2 – the supporting breakdown + a link into the module (on demand)
 *
 * Scoped to the signed-in user's organisation (RLS enforces this too).
 */
export function InsightsCarousel() {
  const { profile, role } = useAuth();
  const orgWide = role === "FINANCE" || role === "ADMIN";
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data: txns } = await supabase
        .from("transactions")
        .select(
          "amount, amount_paid, status, vat_amount, vat_rate, vat_status, vat_assessment_required, document_url, scan_document_path, created_at",
        )
        .gte("created_at", since.toISOString())
        .limit(1000);

      if (cancelled) return;

      const rows = txns || [];
      const expenditure = rows.reduce((s, t) => s + Number(t.amount || 0), 0);
      const paid = rows.reduce((s, t) => s + Number(t.amount_paid || 0), 0);
      const vatIssues = rows.filter(
        (t) => Number(t.vat_rate) > 0 && !Number(t.vat_amount),
      ).length;
      const vatUnassessed = rows.filter((t) => t.vat_assessment_required).length;
      const missingDocs = rows.filter(
        (t) => !t.document_url && !t.scan_document_path,
      ).length;
      const unpaidCount = rows.filter(
        (t) => Number(t.amount_paid || 0) < Number(t.amount || 0),
      ).length;
      const onTrackPct = expenditure > 0 ? Math.round((paid / expenditure) * 100) : 0;

      setData({
        vatIssues,
        vatUnassessed,
        expenditure,
        paid,
        missingDocs,
        onTrackPct,
        outstanding: Math.max(expenditure - paid, 0),
        txnCount: rows.length,
        unpaidCount,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organization_id]);

  const scope = orgWide ? "organisation" : "your";
  const d = data;

  const cards: InsightCard[] = [
    {
      key: "vat",
      label: orgWide ? "VAT issues to review" : "My VAT issues to review",
      value: d ? String(d.vatIssues) : "0",
      color: d?.vatIssues ? "destructive" : "success",
      icon: <AlertTriangle className="h-4 w-4" />,
      explainer: `Transactions with a VAT rate but no VAT captured (${scope} records)`,
      detail: [
        { label: "Awaiting assessment", value: String(d?.vatUnassessed ?? 0) },
        { label: "Transactions reviewed", value: String(d?.txnCount ?? 0) },
      ],
      href: orgWide ? "/finance?tab=vat_dashboard" : undefined,
      hrefLabel: "Open VAT dashboard",
    },
    {
      key: "expenditure",
      label: orgWide ? "Expenditure (90 days)" : "My expenditure (90 days)",
      value: formatCurrency(d?.expenditure || 0),
      color: "primary",
      icon: <TrendingUp className="h-4 w-4" />,
      explainer: `Total approved transaction value (${scope} records)`,
      detail: [
        { label: "Settled to date", value: formatCurrency(d?.paid || 0) },
        { label: "Transactions", value: String(d?.txnCount ?? 0) },
      ],
      href: "/expense-history",
      hrefLabel: "Open expense history",
    },
    {
      key: "docs",
      label: orgWide ? "Missing documentation" : "My missing documentation",
      value: d ? String(d.missingDocs) : "0",
      color: d?.missingDocs ? "warning" : "success",
      icon: <FileWarning className="h-4 w-4" />,
      explainer: `Transactions without an invoice or receipt attached (${scope} records)`,
      detail: [
        {
          label: "Documented",
          value: String(Math.max((d?.txnCount ?? 0) - (d?.missingDocs ?? 0), 0)),
        },
        { label: "Transactions", value: String(d?.txnCount ?? 0) },
      ],
    },
    {
      key: "ontrack",
      label: orgWide ? "On-track spend" : "My on-track spend",
      value: `${d?.onTrackPct || 0}%`,
      color: "success",
      icon: <Target className="h-4 w-4" />,
      explainer: `Share of approved spend already settled (${scope} records)`,
      detail: [
        { label: "Paid", value: formatCurrency(d?.paid || 0) },
        { label: "Approved", value: formatCurrency(d?.expenditure || 0) },
      ],
    },
    {
      key: "outstanding",
      label: orgWide ? "Outstanding to pay" : "My outstanding to pay",
      value: formatCurrency(d?.outstanding || 0),
      color: "warning",
      icon: <Wallet className="h-4 w-4" />,
      explainer: `Approved value not yet paid out (${scope} records)`,
      detail: [
        { label: "Unsettled transactions", value: String(d?.unpaidCount ?? 0) },
        { label: "Already paid", value: formatCurrency(d?.paid || 0) },
      ],
      href: orgWide ? "/finance?tab=payments" : undefined,
      hrefLabel: "Open payment queue",
    },
  ];

  return (
    <Carousel opts={{ align: "start", loop: true }} className="mb-5 sm:mb-7">
      <CarouselContent className="-ml-3">
        {cards.map((c) => {
          const open = openKey === c.key;
          return (
            <CarouselItem
              key={c.key}
              className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
            >
              <div className="h-full bg-white rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                {/* Layer 1 – headline */}
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : c.key)}
                  aria-expanded={open}
                  className="text-left p-3 sm:p-5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-[11px] leading-tight sm:text-sm text-muted-foreground font-medium line-clamp-2">
                      {c.label}
                    </p>
                    {loading ? (
                      <div className="h-8 sm:h-9 w-24 rounded-md bg-muted animate-pulse" />
                    ) : (
                      <p
                        className={cn(
                          "text-xl sm:text-3xl font-bold tracking-tight break-words",
                          colorClasses[c.color],
                        )}
                      >
                        {c.value}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/60 shrink-0">
                    {c.icon}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                {/* Layer 2 – supporting detail */}
                {open && (
                  <div className="px-3 sm:px-5 pb-4 pt-1 border-t border-border/40 space-y-2 animate-fade-in">
                    {c.detail.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-semibold text-foreground">
                          {row.value}
                        </span>
                      </div>
                    ))}
                    <p className="text-[11px] text-muted-foreground pt-1">
                      {c.explainer}
                    </p>
                    {c.href && (
                      <Link
                        to={c.href}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        {c.hrefLabel}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex -left-3" />
      <CarouselNext className="hidden sm:flex -right-3" />
    </Carousel>
  );
}
