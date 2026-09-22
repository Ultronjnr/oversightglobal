import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/landing-bg.jpg";
import {
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Wallet,
  FileWarning,
  ShoppingCart,
  ShieldCheck,
  BarChart3,
  Clock,
  Megaphone,
} from "lucide-react";
import {
  getLiveAdvertisements,
  recordAdvertisementEvent,
  type Advertisement,
} from "@/services/advertisement.service";

interface Snapshot {
  spendMtd: number;
  spendPrevMtd: number;
  outstanding: number;
  unpaidCount: number;
  missingDocs: number;
  prTotal: number;
  prDone: number;
  auditPct: number;
  weekCount: number;
  trend: number[];
  weekBars: number[];
  topSupplier: { name: string; share: number } | null;
  pendingPRs: number;
}

type Tone = "primary" | "success" | "warning" | "destructive";

interface Story {
  key: string;
  kicker: string;
  headline: string;
  sub: string;
  href: string;
  ctaLabel: string;
}

const toneRing: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(1, ...points);
  const d = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * 100;
      const y = 30 - (p / max) * 26;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <path d={d} fill="none" stroke="hsl(var(--success))" strokeWidth="1.6" />
      <path
        d={`${d} L100,30 L0,30 Z`}
        fill="hsl(var(--success) / 0.12)"
        stroke="none"
      />
    </svg>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="hsl(var(--success))"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
      />
    </svg>
  );
}

function Tile({
  label,
  value,
  hint,
  icon,
  iconClass,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: JSX.Element;
  iconClass: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-white/70 bg-white/85 p-3 shadow-[0_1px_0_0_hsl(0_0%_100%)_inset,0_12px_28px_-20px_hsl(220_40%_20%/0.45)] backdrop-blur-xl sm:p-4">
      <div
        className={cn(
          "mb-2 grid h-8 w-8 place-items-center rounded-full text-white shadow-sm",
          iconClass,
        )}
      >
        {icon}
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className="whitespace-nowrap text-sm font-bold tabular-nums leading-tight text-foreground sm:text-base lg:text-lg">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
          {hint}
        </p>
      )}
      {children && <div className="mt-auto pt-1.5">{children}</div>}
    </div>
  );
}

/**
 * Premium intelligence panel shown at the top of every portal.
 *
 * Left: a rotating hero story drawn from the organisation's live data.
 * Middle: six live metric tiles. Right: the advert Ovasyt has published
 * for this organisation (or an Ovasyt message when none is live).
 */
export function SmartPanel() {
  const { profile, role } = useAuth();
  const orgWide = role === "FINANCE" || role === "ADMIN";
  const [data, setData] = useState<Snapshot | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ads, setAds] = useState<Advertisement[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const prevMonthStart = new Date(monthStart);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

      const [{ data: txns }, { data: prs }] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "amount, amount_paid, supplier_name, document_url, scan_document_path, created_at",
          )
          .gte("created_at", prevMonthStart.toISOString())
          .limit(1000),
        supabase.from("purchase_requisitions").select("status").limit(1000),
      ]);

      if (cancelled) return;

      const rows = txns || [];
      const inMonth = rows.filter(
        (t) => new Date(t.created_at as string) >= monthStart,
      );
      const prevMonth = rows.filter((t) => {
        const d = new Date(t.created_at as string);
        return d >= prevMonthStart && d < monthStart;
      });

      const spendMtd = inMonth.reduce((s, t) => s + Number(t.amount || 0), 0);
      const spendPrevMtd = prevMonth.reduce((s, t) => s + Number(t.amount || 0), 0);
      const outstanding = rows.reduce(
        (s, t) =>
          s + Math.max(Number(t.amount || 0) - Number(t.amount_paid || 0), 0),
        0,
      );
      const total = rows.reduce((s, t) => s + Number(t.amount || 0), 0);

      const bySupplier = new Map<string, number>();
      rows.forEach((t) => {
        const key = (t.supplier_name as string) || "Unnamed supplier";
        bySupplier.set(key, (bySupplier.get(key) || 0) + Number(t.amount || 0));
      });
      const top = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])[0];

      // 8 weekly buckets for the sparkline / activity bars
      const now = Date.now();
      const trend: number[] = [];
      const weekBars: number[] = [];
      for (let w = 7; w >= 0; w--) {
        const start = now - (w + 1) * 7 * 86400000;
        const end = now - w * 7 * 86400000;
        const bucket = rows.filter((t) => {
          const d = new Date(t.created_at as string).getTime();
          return d >= start && d < end;
        });
        trend.push(bucket.reduce((s, t) => s + Number(t.amount || 0), 0));
        weekBars.push(bucket.length);
      }

      const missingDocs = rows.filter(
        (t) => !t.document_url && !t.scan_document_path,
      ).length;
      const prRows = prs || [];
      const prDone = prRows.filter((p) =>
        ["FULFILLED", "CLOSED", "FINANCE_APPROVED"].includes(String(p.status)),
      ).length;

      setData({
        spendMtd,
        spendPrevMtd,
        outstanding,
        unpaidCount: rows.filter(
          (t) => Number(t.amount_paid || 0) < Number(t.amount || 0),
        ).length,
        missingDocs,
        prTotal: prRows.length,
        prDone,
        auditPct:
          rows.length > 0
            ? Math.round(((rows.length - missingDocs) / rows.length) * 100)
            : 100,
        weekCount: weekBars[weekBars.length - 1] || 0,
        trend,
        weekBars,
        topSupplier:
          top && total > 0
            ? { name: top[0], share: Math.round((top[1] / total) * 100) }
            : null,
        pendingPRs: prRows.filter((p) => String(p.status).startsWith("PENDING"))
          .length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organization_id]);

  useEffect(() => {
    getLiveAdvertisements().then(setAds);
  }, []);

  const advert = ads[0] ?? null;

  useEffect(() => {
    if (advert) {
      recordAdvertisementEvent(advert.id, "VIEW", profile?.organization_id ?? null);
    }
  }, [advert?.id, profile?.organization_id]);

  const stories = useMemo<Story[]>(() => {
    const d = data;
    const list: Story[] = [
      {
        key: "intro",
        kicker: "Ovasyt",
        headline: "Smarter spend. Greater impact.",
        sub: "Track your finances, stay compliant and make better decisions with real-time insights — all in one place.",
        href: "/analytics",
        ctaLabel: "Open analytics",
      },
    ];

    if (d?.topSupplier) {
      list.push({
        key: "supplier",
        kicker: "From your data",
        headline: `${d.topSupplier.name} is ${d.topSupplier.share}% of spend`,
        sub: "Your biggest supplier over the last 90 days. Compare quotes before the next order.",
        href: "/analytics",
        ctaLabel: "See breakdown",
      });
    }

    if (orgWide) {
      list.push({
        key: "outstanding",
        kicker: "Waiting to be paid",
        headline: formatCurrency(d?.outstanding || 0),
        sub: `${d?.unpaidCount ?? 0} approved items are still unsettled. Create a payment batch to clear them.`,
        href: "/admin/portal?tab=payments",
        ctaLabel: "Open payment queue",
      });
    }

    list.push({
      key: "docs",
      kicker: "Audit readiness",
      headline: d?.missingDocs
        ? `${d.missingDocs} records without a document`
        : "Every record has a document",
      sub: d?.missingDocs
        ? "Attach the invoice or receipt so SARS reviews stay painless."
        : "Your records are fully supported by documents.",
      href: "/expenses",
      ctaLabel: "Open expense history",
    });

    list.push({
      key: "approvals",
      kicker: "Needs a decision",
      headline: `${d?.pendingPRs ?? 0} requisitions in review`,
      sub: "Approvals move faster when they are cleared the same day.",
      href:
        role === "HOD"
          ? "/hod/portal"
          : role === "FINANCE"
            ? "/finance/portal?tab=incoming"
            : role === "ADMIN"
              ? "/admin/portal?tab=approvals"
              : "/employee/portal?tab=requisitions",
      ctaLabel: "Review requisitions",
    });

    return list;
  }, [data, orgWide, role]);

  const total = stories.length;
  useEffect(() => {
    if (paused || total < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 8000);
    return () => clearInterval(t);
  }, [paused, total]);

  const story = stories[Math.min(index, total - 1)];
  const loading = !data;
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();
  const mtdDelta =
    data && data.spendPrevMtd > 0
      ? Math.round(
          ((data.spendMtd - data.spendPrevMtd) / data.spendPrevMtd) * 100,
        )
      : null;
  const barMax = Math.max(1, ...(data?.weekBars ?? [1]));

  return (
    <section
      aria-label="Smart insights"
      className="mb-5 w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-primary/10 via-primary/5 to-white p-2.5 shadow-[0_20px_50px_-24px_hsl(var(--primary)/0.45)] sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.75fr_0.9fr]">
          {/* Hero story */}
          <div className="relative min-h-[260px] overflow-hidden rounded-2xl text-white">
            <img
              src={heroBg}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/40"
            />
            <div className="relative flex h-full flex-col p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {greeting}, {profile?.name || "there"}
                  </p>
                  <p className="text-[11px] leading-tight text-white/80">
                    Here's what's happening with your organisation today.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
                  {story.kicker}
                </p>
                <h2 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
                  {story.headline}
                </h2>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-white/85 sm:text-sm">
                  {story.sub}
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="mt-3 rounded-full"
                >
                  <Link to={story.href}>
                    {story.ctaLabel}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {stories.map((s, i) => (
                    <button
                      key={s.key}
                      aria-label={`Show ${s.kicker}`}
                      onClick={() => setIndex(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === index ? "w-6 bg-white" : "w-1.5 bg-white/50",
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    aria-label="Previous insight"
                    onClick={() => setIndex((i) => (i - 1 + total) % total)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Next insight"
                    onClick={() => setIndex((i) => (i + 1) % total)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live metric tiles */}
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
            <Tile
              label="Total Spend (MTD)"
              value={loading ? "—" : formatCurrency(data!.spendMtd)}
              hint={
                mtdDelta === null
                  ? undefined
                  : `${mtdDelta >= 0 ? "↑" : "↓"} ${Math.abs(mtdDelta)}% vs last month`
              }
              icon={<Wallet className="h-4 w-4" />}
              iconClass="bg-success"
            >
              <Sparkline points={data?.trend ?? [0, 0, 0]} />
            </Tile>

            <Tile
              label="Outstanding Payables"
              value={loading ? "—" : formatCurrency(data!.outstanding)}
              hint={`${data?.unpaidCount ?? 0} items pending`}
              icon={<Clock className="h-4 w-4" />}
              iconClass="bg-warning"
            />

            <Tile
              label="Undocumented Records"
              value={loading ? "—" : String(data!.missingDocs)}
              hint="require attention"
              icon={<FileWarning className="h-4 w-4" />}
              iconClass="bg-destructive"
            />

            <Tile
              label="Procurement Progress"
              value={loading ? "—" : `${data!.prDone} / ${data!.prTotal}`}
              hint="completed"
              icon={<ShoppingCart className="h-4 w-4" />}
              iconClass="bg-primary"
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${
                      data && data.prTotal > 0
                        ? Math.round((data.prDone / data.prTotal) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </Tile>

            <Tile
              label="Audit Readiness"
              value={loading ? "—" : `${data!.auditPct}%`}
              hint="on track"
              icon={<ShieldCheck className="h-4 w-4" />}
              iconClass="bg-success"
            >
              <div className="flex items-center gap-2">
                <Ring pct={data?.auditPct ?? 0} />
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    toneRing.success,
                  )}
                >
                  {data?.auditPct ?? 0}%
                </span>
              </div>
            </Tile>

            <Tile
              label="Recent Activity"
              value={loading ? "—" : String(data!.weekCount)}
              hint="transactions this week"
              icon={<BarChart3 className="h-4 w-4" />}
              iconClass="bg-primary"
            >
              <div className="flex h-8 items-end gap-1">
                {(data?.weekBars ?? []).map((b, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-primary/60"
                    style={{ height: `${Math.max(8, (b / barMax) * 100)}%` }}
                  />
                ))}
              </div>
            </Tile>
          </div>

          {/* Advert / notice column */}
          <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-b from-primary/15 to-white p-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
              <Megaphone className="h-3.5 w-3.5" />
              {advert ? "Quick Updates" : "From Ovasyt"}
            </div>
            <h3 className="mt-3 text-lg font-bold leading-tight text-foreground">
              {advert ? advert.headline : "Scan an invoice, skip the typing"}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {advert
                ? advert.body
                : "Ovi reads your invoice, fills in the transaction and matches the donor and project for you."}
            </p>
            {advert?.cta_url ? (
              advert.cta_url.startsWith("http") ? (
                <Button
                  asChild
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={() =>
                    recordAdvertisementEvent(
                      advert.id,
                      "CLICK",
                      profile?.organization_id ?? null,
                    )
                  }
                >
                  <a href={advert.cta_url} target="_blank" rel="noreferrer">
                    {advert.cta_label || "Learn more"}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={() =>
                    recordAdvertisementEvent(
                      advert.id,
                      "CLICK",
                      profile?.organization_id ?? null,
                    )
                  }
                >
                  <Link to={advert.cta_url}>
                    {advert.cta_label || "Learn more"}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )
            ) : (
              !advert && (
                <Button asChild size="sm" className="mt-4 rounded-full">
                  <Link to="/billing">
                    See what's included
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
