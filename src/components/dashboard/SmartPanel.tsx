import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import heroCorporate from "@/assets/hero-corporate.jpg";
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
  FileCheck2,
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

const AUTOPLAY_MS = 6000;

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
      <path d={`${d} L100,30 L0,30 Z`} fill="hsl(var(--success) / 0.12)" stroke="none" />
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
    <div className="flex min-w-0 flex-col rounded-2xl border border-white/70 bg-white/90 p-3 shadow-[0_1px_0_0_hsl(0_0%_100%)_inset,0_16px_34px_-22px_hsl(220_40%_20%/0.5)] backdrop-blur-xl sm:p-4">
      <div
        className={cn(
          "mb-2 grid h-9 w-9 place-items-center rounded-full text-white shadow-sm",
          iconClass,
        )}
      >
        {icon}
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</p>
      <p className="whitespace-nowrap text-base font-bold tabular-nums leading-tight text-foreground sm:text-lg lg:text-xl">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{hint}</p>
      )}
      {children && <div className="mt-auto pt-1.5">{children}</div>}
    </div>
  );
}

/**
 * Large hero carousel shown at the top of every portal.
 *
 * Slide 1 — live organisation insights (greeting, headline, six KPI tiles,
 * quick-updates column). Slide 2 — the advert Ovasyt published for this
 * organisation (omitted entirely when none is live). Slide 3 — audit and
 * compliance readiness. Autoplays every 6s, pauses on interaction.
 */
export function SmartPanel() {
  const { profile, role } = useAuth();
  const orgWide = role === "FINANCE" || role === "ADMIN";
  const [data, setData] = useState<Snapshot | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      const inMonth = rows.filter((t) => new Date(t.created_at as string) >= monthStart);
      const prevMonth = rows.filter((t) => {
        const d = new Date(t.created_at as string);
        return d >= prevMonthStart && d < monthStart;
      });

      const spendMtd = inMonth.reduce((s, t) => s + Number(t.amount || 0), 0);
      const spendPrevMtd = prevMonth.reduce((s, t) => s + Number(t.amount || 0), 0);
      const outstanding = rows.reduce(
        (s, t) => s + Math.max(Number(t.amount || 0) - Number(t.amount_paid || 0), 0),
        0,
      );
      const total = rows.reduce((s, t) => s + Number(t.amount || 0), 0);

      const bySupplier = new Map<string, number>();
      rows.forEach((t) => {
        const key = (t.supplier_name as string) || "Unnamed supplier";
        bySupplier.set(key, (bySupplier.get(key) || 0) + Number(t.amount || 0));
      });
      const top = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])[0];

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

      const missingDocs = rows.filter((t) => !t.document_url && !t.scan_document_path).length;
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
        pendingPRs: prRows.filter((p) => String(p.status).startsWith("PENDING")).length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organization_id]);

  useEffect(() => {
    let cancelled = false;
    getLiveAdvertisements().then((rows) => {
      if (!cancelled) setAds(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.organization_id]);

  const advert = ads[0] ?? null;

  useEffect(() => {
    if (advert) {
      recordAdvertisementEvent(advert.id, "VIEW", profile?.organization_id ?? null);
    }
  }, [advert?.id, profile?.organization_id]);

  const loading = !data;
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();
  const firstName = (profile?.name || "there").split(" ")[0];
  const mtdDelta =
    data && data.spendPrevMtd > 0
      ? Math.round(((data.spendMtd - data.spendPrevMtd) / data.spendPrevMtd) * 100)
      : null;
  const barMax = Math.max(1, ...(data?.weekBars ?? [1]));
  const approvalsHref =
    role === "HOD"
      ? "/hod/portal"
      : role === "FINANCE"
        ? "/finance/portal?tab=incoming"
        : role === "ADMIN"
          ? "/admin/portal?tab=approvals"
          : "/employee/portal?tab=requisitions";

  // Slides are rebuilt only when their inputs change — no work per tick.
  const slides = useMemo(
    () => ["insights", ...(advert ? ["advert"] : []), "audit"] as const,
    [advert],
  );
  const total = slides.length;

  useEffect(() => {
    if (index > total - 1) setIndex(0);
  }, [index, total]);

  useEffect(() => {
    if (paused || total < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, total]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  /** Any manual interaction pauses autoplay, which resumes shortly after. */
  const interact = useCallback((next: (i: number) => number) => {
    setPaused(true);
    setIndex((i) => next(i));
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 12000);
  }, []);

  const active = slides[Math.min(index, total - 1)];

  const adCta = advert?.cta_url ? (
    advert.cta_url.startsWith("http") ? (
      <Button
        asChild
        className="mt-4 rounded-full"
        onClick={() =>
          recordAdvertisementEvent(advert.id, "CLICK", profile?.organization_id ?? null)
        }
      >
        <a href={advert.cta_url} target="_blank" rel="noreferrer">
          {advert.cta_label || "Learn more"}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    ) : (
      <Button
        asChild
        className="mt-4 rounded-full"
        onClick={() =>
          recordAdvertisementEvent(advert.id, "CLICK", profile?.organization_id ?? null)
        }
      >
        <Link to={advert.cta_url}>
          {advert.cta_label || "Learn more"}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>
    )
  ) : null;

  return (
    <section
      aria-label="Organisation insights"
      aria-roledescription="carousel"
      className="mb-6 w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative w-full overflow-hidden rounded-[28px] border border-white/60 shadow-[0_34px_80px_-40px_hsl(var(--primary)/0.6)]">
        {/* Shared background — loaded once for every slide */}
        <img
          src={heroCorporate}
          alt=""
          aria-hidden
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-primary/80 via-primary/35 to-primary/5"
        />

        <div className="relative min-h-[520px] p-4 sm:p-6 lg:min-h-[440px] lg:px-14 lg:py-7">
          {/* Slide 1 — live organisation insights */}
          {active === "insights" && (
            <div className="grid animate-fade-in gap-4 lg:grid-cols-[1.05fr_1.7fr_0.95fr]">
              <div className="flex flex-col text-white">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 backdrop-blur">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-tight">
                      {greeting}, {firstName}
                    </p>
                    <p className="text-xs leading-tight text-white/85">
                      Here's what's happening with your organisation today.
                    </p>
                  </div>
                </div>

                <div className="mt-8 lg:mt-12">
                  <h2 className="text-3xl font-bold leading-[1.1] tracking-tight drop-shadow-sm sm:text-4xl">
                    Smarter spend. Greater impact.
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
                    Track your finances, stay compliant and make better decisions with
                    real-time insights — all in one place.
                  </p>
                  <Button asChild variant="secondary" className="mt-5 rounded-full">
                    <Link to="/analytics">
                      Open analytics
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
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
                    <span className="text-xs font-semibold tabular-nums text-success">
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

              <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_-24px_hsl(220_40%_20%/0.55)] backdrop-blur-xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                  <Megaphone className="h-3.5 w-3.5" />
                  Quick Updates
                </div>
                <h3 className="mt-3 text-xl font-bold leading-tight text-foreground">
                  {advert ? advert.headline : "Scan an invoice, skip the typing"}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {advert?.body ||
                    "Ovi reads your invoice, fills in the transaction and matches the donor and project for you."}
                </p>
                {adCta ?? (
                  <Button asChild className="mt-4 rounded-full">
                    <Link to="/billing">
                      Learn more
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Slide 2 — advertisement (only rendered when one is live) */}
          {active === "advert" && advert && (
            <div className="grid animate-fade-in items-center gap-6 lg:grid-cols-[1.15fr_1fr]">
              <div className="text-white">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                  <Megaphone className="h-3.5 w-3.5" />
                  Featured for your organisation
                </div>
                <h2 className="mt-5 text-3xl font-bold leading-[1.1] tracking-tight drop-shadow-sm sm:text-4xl">
                  {advert.headline}
                </h2>
                {advert.body && (
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
                    {advert.body}
                  </p>
                )}
                {adCta}
              </div>
              <div className="hidden items-center justify-center lg:flex">
                {advert.image_url ? (
                  <img
                    src={advert.image_url}
                    alt={advert.title}
                    loading="lazy"
                    className="max-h-[300px] w-full rounded-2xl border border-white/60 object-cover shadow-xl"
                  />
                ) : (
                  <div className="grid h-[240px] w-full place-items-center rounded-2xl border border-white/50 bg-white/15 backdrop-blur-xl">
                    <Sparkles className="h-14 w-14 text-white/80" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Slide 3 — audit & compliance readiness */}
          {active === "audit" && (
            <div className="grid animate-fade-in gap-5 lg:grid-cols-[1.05fr_1.7fr]">
              <div className="text-white">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Audit readiness
                </div>
                <h2 className="mt-5 text-3xl font-bold leading-[1.1] tracking-tight drop-shadow-sm sm:text-4xl">
                  {loading
                    ? "Checking your records…"
                    : data!.missingDocs > 0
                      ? `${data!.missingDocs} records need a document`
                      : "Every record is fully supported"}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
                  {data?.missingDocs
                    ? "Attach the invoice or receipt so a SARS or donor review stays painless."
                    : "Your documentation is complete. Keep scanning invoices as they arrive."}
                </p>
                <Button asChild variant="secondary" className="mt-5 rounded-full">
                  <Link to="/expenses">
                    Open expense history
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-2">
                <Tile
                  label="Documentation status"
                  value={loading ? "—" : `${data!.auditPct}%`}
                  hint="records with a document"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  iconClass="bg-success"
                >
                  <div className="flex items-center gap-2">
                    <Ring pct={data?.auditPct ?? 0} />
                    <span className="text-xs font-semibold tabular-nums text-success">
                      {data?.auditPct ?? 0}%
                    </span>
                  </div>
                </Tile>
                <Tile
                  label="Outstanding documents"
                  value={loading ? "—" : String(data!.missingDocs)}
                  hint="need an invoice or receipt"
                  icon={<FileWarning className="h-4 w-4" />}
                  iconClass="bg-destructive"
                />
                <Tile
                  label="Procurement activity"
                  value={loading ? "—" : `${data!.prDone} / ${data!.prTotal}`}
                  hint="requisitions completed"
                  icon={<ShoppingCart className="h-4 w-4" />}
                  iconClass="bg-primary"
                />
                <Tile
                  label={orgWide ? "Awaiting a decision" : "Your open requisitions"}
                  value={loading ? "—" : String(data!.pendingPRs)}
                  hint="in review"
                  icon={<FileCheck2 className="h-4 w-4" />}
                  iconClass="bg-warning"
                >
                  <Link
                    to={approvalsHref}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Review requisitions →
                  </Link>
                </Tile>
              </div>
            </div>
          )}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => interact((i) => (i - 1 + total) % total)}
              className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-primary shadow-lg backdrop-blur transition hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => interact((i) => (i + 1) % total)}
              className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-primary shadow-lg backdrop-blur transition hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => interact(() => i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
