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
  topSupplier: { name: string; share: number } | null;
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

const toneOrb: Record<Tone, string> = {
  primary: "bg-primary/25",
  success: "bg-success/25",
  warning: "bg-warning/25",
  destructive: "bg-destructive/25",
};

const toneBackground: Record<Tone, string> = {
  primary:
    "bg-gradient-to-br from-primary/[0.14] via-primary/[0.06] to-transparent",
  success:
    "bg-gradient-to-br from-success/[0.14] via-success/[0.06] to-transparent",
  warning:
    "bg-gradient-to-br from-warning/[0.14] via-warning/[0.06] to-transparent",
  destructive:
    "bg-gradient-to-br from-destructive/[0.14] via-destructive/[0.06] to-transparent",
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
            "amount, amount_paid, supplier_name, vat_amount, vat_rate, document_url, scan_document_path, created_at",
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

      const bySupplier = new Map<string, number>();
      rows.forEach((t) => {
        const key = (t.supplier_name as string) || "Unnamed supplier";
        bySupplier.set(key, (bySupplier.get(key) || 0) + Number(t.amount || 0));
      });
      const top = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])[0];

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
        topSupplier:
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

    if (d?.topSupplier) {
      list.push({
        key: "top-supplier",
        kind: "insight",
        kicker: "From your data",
        headline: `${d.topSupplier.name} is ${d.topSupplier.share}% of spend`,
        sub: `Your biggest supplier over the last 90 days ${scope}.`,
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
      style={{ perspective: "1600px" }}
      className="group/panel mb-5 sm:mb-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/60",
          "bg-white/60 backdrop-blur-2xl",
          "shadow-[0_1px_0_0_hsl(0_0%_100%/0.9)_inset,0_24px_60px_-24px_hsl(var(--primary)/0.35),0_8px_24px_-12px_hsl(220_40%_20%/0.18)]",
          "transition-transform duration-500 ease-out will-change-transform",
          "group-hover/panel:-translate-y-0.5",
        )}
      >
        {/* Ambient depth orbs */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full blur-3xl opacity-60 transition-colors duration-700",
            slide.kind === "ad" ? "bg-primary/25" : toneOrb[slide.tone],
          )}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/30 to-transparent"
        />

        {/* Identity + compact figures */}
        <div className="relative p-3 sm:p-4 border-b border-white/50">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center font-bold text-xs sm:text-sm shrink-0 shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.8)]">
              {(orgName || profile?.name || "O").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                {orgName || "Your organisation"}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Smart insights, refreshed from your live data
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {strip.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/70 px-2 sm:px-3 py-2 text-center shadow-[0_1px_0_0_hsl(0_0%_100%)_inset,0_10px_24px_-18px_hsl(220_40%_20%/0.5)] transition-transform duration-300 hover:-translate-y-0.5"
              >
                {loading ? (
                  <div className="h-4 sm:h-5 w-14 sm:w-16 mx-auto rounded bg-muted animate-pulse" />
                ) : (
                  <p className="text-xs sm:text-base font-bold text-foreground tabular-nums truncate">
                    {s.value}
                  </p>
                )}
                <p className="text-[9px] sm:text-[11px] text-muted-foreground mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Rotating stage */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div
                key={s.key}
                aria-hidden={i !== index}
                className={cn(
                  "w-full shrink-0 p-4 sm:p-5 min-h-[148px] sm:min-h-[168px]",
                  "transition-all duration-700 ease-out",
                  i === index ? "opacity-100 scale-100" : "opacity-40 scale-[0.97]",
                  s.kind === "ad"
                    ? "bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent"
                    : toneBackground[s.tone],
                )}
              >
                <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid place-items-center h-8 w-8 sm:h-9 sm:w-9 rounded-2xl bg-white/80 backdrop-blur border border-white/70 shadow-[0_10px_24px_-14px_hsl(220_40%_20%/0.6)]",
                        toneText[s.tone],
                      )}
                    >
                      {s.icon}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {s.kicker}
                    </span>
                  </div>
                  {s.kind === "ad" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-white/70 backdrop-blur border border-white/70 rounded-full px-2.5 py-0.5">
                      Sponsored
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="h-6 sm:h-8 w-2/3 rounded bg-muted animate-pulse" />
                    <div className="h-3.5 sm:h-4 w-1/2 rounded bg-muted animate-pulse" />
                  </div>
                ) : (
                  <>
                    <h2
                      className={cn(
                        "text-lg sm:text-2xl font-bold tracking-tight leading-tight drop-shadow-[0_1px_0_hsl(0_0%_100%)]",
                        s.kind === "ad" ? "text-foreground" : toneText[s.tone],
                      )}
                    >
                      {s.headline}
                    </h2>
                    <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground max-w-xl">
                      {s.sub}
                    </p>
                    {s.href && (
                      <Button
                        asChild
                        size="sm"
                        className="mt-3 sm:mt-4 gap-2 rounded-full shadow-[0_12px_28px_-12px_hsl(var(--primary)/0.9)] transition-transform hover:-translate-y-0.5"
                      >
                        <Link to={s.href}>
                          {s.ctaLabel}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="relative flex items-center justify-between px-4 sm:px-5 pb-4">
            <div className="flex items-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  aria-label={`Show slide ${i + 1}`}
                  onClick={() => go(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    i === index
                      ? "w-8 bg-gradient-to-r from-primary to-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.7)]"
                      : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-white/70 backdrop-blur border border-white/70 hover:bg-white"
                aria-label="Previous insight"
                onClick={() => go(index - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-white/70 backdrop-blur border border-white/70 hover:bg-white"
                aria-label="Next insight"
                onClick={() => go(index + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Autoplay progress */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/40">
            <div
              key={`${index}-${paused}`}
              className={cn(
                "h-full bg-gradient-to-r from-primary to-primary/40",
                paused ? "w-0" : "animate-smart-progress",
              )}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
