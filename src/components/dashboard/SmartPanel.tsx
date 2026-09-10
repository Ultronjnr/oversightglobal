import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileWarning,
  TrendingUp,
  Wallet,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

interface Snapshot {
  expenditure: number;
  paid: number;
  outstanding: number;
  txnCount: number;
  unpaidCount: number;
  vatIssues: number;
  missingDocs: number;
  onTrackPct: number;
  pendingPRs: number;
  topCategory: { name: string; share: number } | null;
}

type Tone = "primary" | "success" | "warning" | "destructive";

interface Slide {
  key: string;
  kind: "insight" | "ad";
  kicker: string;
  headline: string;
  sub: string;
  tone: Tone;
  icon: JSX.Element;
  href?: string;
  ctaLabel?: string;
}

const toneText: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

const toneGlow: Record<Tone, string> = {
  primary: "from-primary/10",
  success: "from-success/10",
  warning: "from-warning/10",
  destructive: "from-destructive/10",
};

/**
 * Smart intelligence panel shown at the top of every portal.
 *
 * A single auto-rotating stage: role-aware insight slides drawn from the
 * organisation's live data, plus an Ovasyt promotional slide. A compact
 * three-figure strip stays visible above the stage at all times.
 */
export function SmartPanel() {
  const { profile, role } = useAuth();
  const orgWide = role === "FINANCE" || role === "ADMIN";
  const [data, setData] = useState<Snapshot | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const [{ data: txns }, { data: prs }, { data: org }] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "amount, amount_paid, category, vat_amount, vat_rate, document_url, scan_document_path, created_at",
          )
          .gte("created_at", since.toISOString())
          .limit(1000),
        supabase.from("purchase_requisitions").select("status").limit(1000),
        profile?.organization_id
          ? supabase
              .from("organizations")
              .select("name")
              .eq("id", profile.organization_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (cancelled) return;

      const rows = txns || [];
      const expenditure = rows.reduce((s, t) => s + Number(t.amount || 0), 0);
      const paid = rows.reduce((s, t) => s + Number(t.amount_paid || 0), 0);

      const byCategory = new Map<string, number>();
      rows.forEach((t) => {
        const key = (t.category as string) || "Uncategorised";
        byCategory.set(key, (byCategory.get(key) || 0) + Number(t.amount || 0));
      });
      const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

      setOrgName(((org as { name?: string } | null)?.name as string) || "");
      setData({
        expenditure,
        paid,
        outstanding: Math.max(expenditure - paid, 0),
        txnCount: rows.length,
        unpaidCount: rows.filter(
          (t) => Number(t.amount_paid || 0) < Number(t.amount || 0),
        ).length,
        vatIssues: rows.filter((t) => Number(t.vat_rate) > 0 && !Number(t.vat_amount))
          .length,
        missingDocs: rows.filter((t) => !t.document_url && !t.scan_document_path)
          .length,
        onTrackPct: expenditure > 0 ? Math.round((paid / expenditure) * 100) : 0,
        pendingPRs: (prs || []).filter((p) =>
          String(p.status).startsWith("PENDING"),
        ).length,
        topCategory:
          top && expenditure > 0
            ? { name: top[0], share: Math.round((top[1] / expenditure) * 100) }
            : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organization_id]);

  const slides = useMemo<Slide[]>(() => {
    const d = data;
    const scope = orgWide ? "across the organisation" : "on your records";
    const list: Slide[] = [];

    if (d?.topCategory) {
      list.push({
        key: "top-category",
        kind: "insight",
        kicker: "From your data",
        headline: `${d.topCategory.name} is ${d.topCategory.share}% of spend`,
        sub: `Your biggest category over the last 90 days ${scope}.`,
        tone: "primary",
        icon: <TrendingUp className="h-5 w-5" />,
        href: "/analytics",
        ctaLabel: "See breakdown",
      });
    }

    list.push({
      key: "expenditure",
      kind: "insight",
      kicker: "Last 90 days",
      headline: formatCurrency(d?.expenditure || 0),
      sub: `${d?.txnCount ?? 0} transactions captured, ${formatCurrency(
        d?.paid || 0,
      )} already settled.`,
      tone: "primary",
      icon: <TrendingUp className="h-5 w-5" />,
      href: "/expenses",
      ctaLabel: "Open expense history",
    });

    if (orgWide) {
      list.push({
        key: "outstanding",
        kind: "insight",
        kicker: "Waiting to be paid",
        headline: formatCurrency(d?.outstanding || 0),
        sub: `${d?.unpaidCount ?? 0} approved items are still unsettled.`,
        tone: "warning",
        icon: <Wallet className="h-5 w-5" />,
        href: "/finance/portal?tab=payments",
        ctaLabel: "Open payment queue",
      });
      list.push({
        key: "vat",
        kind: "insight",
        kicker: "VAT health",
        headline: d?.vatIssues
          ? `${d.vatIssues} VAT issues to review`
          : "VAT looks clean",
        sub: d?.vatIssues
          ? "These records carry a VAT rate but no VAT amount."
          : "No transactions with a missing VAT amount right now.",
        tone: d?.vatIssues ? "destructive" : "success",
        icon: d?.vatIssues ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <ShieldCheck className="h-5 w-5" />
        ),
        href: "/finance/portal?tab=vat_dashboard",
        ctaLabel: "Open VAT dashboard",
      });
    }

    if (role === "HOD" || role === "ADMIN" || role === "FINANCE") {
      list.push({
        key: "pending",
        kind: "insight",
        kicker: "Needs a decision",
        headline: `${d?.pendingPRs ?? 0} requisitions awaiting approval`,
        sub: "Approvals move faster when they are cleared the same day.",
        tone: d?.pendingPRs ? "warning" : "success",
        icon: <ClipboardList className="h-5 w-5" />,
        href:
          role === "HOD"
            ? "/hod/portal"
            : role === "FINANCE"
              ? "/finance/portal?tab=incoming"
              : "/admin/portal?tab=all_prs",
        ctaLabel: "Review requisitions",
      });
    } else {
      list.push({
        key: "my-pending",
        kind: "insight",
        kicker: "Your requests",
        headline: `${d?.pendingPRs ?? 0} of yours are in review`,
        sub: "Track where each requisition sits in the approval chain.",
        tone: d?.pendingPRs ? "warning" : "success",
        icon: <ClipboardList className="h-5 w-5" />,
        href: "/employee/portal?tab=requisitions",
        ctaLabel: "View my requisitions",
      });
    }

    list.push({
      key: "docs",
      kind: "insight",
      kicker: "Audit readiness",
      headline: d?.missingDocs
        ? `${d.missingDocs} records without a document`
        : "Every record has a document",
      sub: d?.missingDocs
        ? "Attach the invoice or receipt so SARS reviews stay painless."
        : `${d?.txnCount ?? 0} transactions are fully documented.`,
      tone: d?.missingDocs ? "warning" : "success",
      icon: d?.missingDocs ? (
        <FileWarning className="h-5 w-5" />
      ) : (
        <ShieldCheck className="h-5 w-5" />
      ),
      href: "/expenses",
      ctaLabel: "Open expense history",
    });

    list.push({
      key: "ovasyt-ad",
      kind: "ad",
      kicker: "From Ovasyt",
      headline: "Scan an invoice, skip the typing",
      sub: "Ovi reads your invoice, fills the transaction and matches the donor and project for you.",
      tone: "primary",
      icon: <Sparkles className="h-5 w-5" />,
      href: "/billing",
      ctaLabel: "See what's included",
    });

    return list;
  }, [data, orgWide, role]);

  const total = slides.length;
  const go = useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total],
  );

  useEffect(() => {
    if (paused || total < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 7000);
    return () => clearInterval(t);
  }, [paused, total]);

  const slide = slides[Math.min(index, total - 1)];
  const loading = !data;

  const strip = orgWide
    ? [
        { label: "Tracked", value: formatCurrency(data?.expenditure || 0) },
        { label: "Outstanding", value: formatCurrency(data?.outstanding || 0) },
        { label: "Undocumented", value: String(data?.missingDocs ?? 0) },
      ]
    : [
        { label: "Tracked", value: formatCurrency(data?.expenditure || 0) },
        { label: "In review", value: String(data?.pendingPRs ?? 0) },
        { label: "Undocumented", value: String(data?.missingDocs ?? 0) },
      ];

  return (
    <section
      aria-label="Smart insights"
      className="mb-5 sm:mb-7 rounded-2xl border border-border/50 bg-white shadow-sm overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Identity + compact figures */}
      <div className="p-4 sm:p-5 border-b border-border/40">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-sm shrink-0">
            {(orgName || profile?.name || "O").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              {orgName || "Your organisation"}
            </p>
            <p className="text-xs text-muted-foreground">
              Smart insights, refreshed from your live data
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {strip.map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-muted/40 border border-border/40 px-3 py-2.5 text-center"
            >
              {loading ? (
                <div className="h-5 w-16 mx-auto rounded bg-muted animate-pulse" />
              ) : (
                <p className="text-sm sm:text-lg font-bold text-foreground tabular-nums truncate">
                  {s.value}
                </p>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Rotating stage */}
      <div className="relative">
        <div
          key={slide.key}
          className={cn(
            "relative animate-fade-in p-5 sm:p-7 min-h-[190px] sm:min-h-[200px] bg-gradient-to-br to-transparent",
            slide.kind === "ad" ? "from-primary/10" : toneGlow[slide.tone],
          )}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid place-items-center h-7 w-7 rounded-full bg-white shadow-sm",
                  toneText[slide.tone],
                )}
              >
                {slide.icon}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {slide.kicker}
              </span>
            </div>
            {slide.kind === "ad" && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border/60 rounded-full px-2 py-0.5">
                Sponsored
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-8 w-2/3 rounded bg-muted animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          ) : (
            <>
              <h2
                className={cn(
                  "text-xl sm:text-3xl font-bold tracking-tight leading-tight",
                  slide.kind === "ad" ? "text-foreground" : toneText[slide.tone],
                )}
              >
                {slide.headline}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                {slide.sub}
              </p>
              {slide.href && (
                <Button asChild size="sm" className="mt-4 gap-2">
                  <Link to={slide.href}>
                    {slide.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-4 sm:px-5 pb-4">
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous insight"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Next insight"
              onClick={() => go(index + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
