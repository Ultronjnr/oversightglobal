import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { X, Check, ArrowRight, Sparkles, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";
import { useRevealOnScroll } from "@/hooks/use-reveal-on-scroll";

import slideBg1 from "@/assets/slide-leaking-money.jpg.asset.json";
import slideBg2 from "@/assets/slide-sars-proof.jpg.asset.json";
import slideBg3 from "@/assets/slide-every-rand.jpg.asset.json";
import slideBg4 from "@/assets/slide-whatsapp.jpg.asset.json";
import slideBg5 from "@/assets/slide-vat.jpg.asset.json";
import spendControlBg from "@/assets/spend-control-bg.jpg.asset.json";

type Slide = {
  accent: string;
  kicker: string;
  headline: { text: string; accent?: boolean }[];
  image: string;
  problems: { title: string; desc: string }[];
  stat: {
    label: string;
    rows: { label: string; value: string }[];
    footerLabel: string;
    footerValue: string;
  };
};

const SLIDES: Slide[] = [
  {
    accent: "#ef4444",
    kicker: "For South African SMEs",
    headline: [
      { text: "Your business is leaking money. " },
      { text: "You just can't see where.", accent: true },
    ],
    image: slideBg1.url,
    problems: [
      { title: "Untracked expenditure", desc: "Purchases made and approved after the fact, if at all" },
      { title: "Unclaimed VAT", desc: "Valid claims lost simply because the invoice wasn't checked" },
      { title: "Untracked supplier invoices", desc: "Leading to overpaying balances you don't actually owe" },
    ],
    stat: {
      label: "Where it's going right now",
      rows: [
        { label: "VAT input claims rejected by SARS", value: "R 18,460" },
        { label: "Unapproved spending", value: "R 64,200" },
        { label: "Overspending", value: "R 31,500" },
      ],
      footerLabel: "With Ovasyt, this quarter",
      footerValue: "R 0 unaccounted for",
    },
  },
  {
    accent: "#f59e0b",
    kicker: "For South African SMEs",
    headline: [
      { text: "If SARS asked for proof right now, " },
      { text: "could you find it?", accent: true },
    ],
    image: slideBg2.url,
    problems: [
      { title: "No single source of truth", desc: "Approvals live in inboxes, chats, and someone's memory" },
      { title: "Incomplete invoices", desc: "Missing the detail SARS needs to support a claim" },
      { title: "Days lost to reconstruction", desc: "Rebuilding a trail that should already exist" },
    ],
    stat: {
      label: "What an audit would find",
      rows: [
        { label: "Approvals with no documented trail", value: "47 this quarter" },
        { label: "Invoices missing SARS-required detail", value: "R 18,460" },
        { label: "Days lost reconstructing records", value: "3 days" },
      ],
      footerLabel: "With Ovasyt, any day",
      footerValue: "One click to export",
    },
  },
  {
    accent: "#3b82f6",
    kicker: "For South African SMEs",
    headline: [
      { text: "Know exactly where every rand goes. " },
      { text: "Before it goes.", accent: true },
    ],
    image: slideBg3.url,
    problems: [
      { title: "Spending happens, then gets explained", desc: "Approval comes after the money's already moved" },
      { title: "No clear chain of sign-off", desc: "\"Who approved this?\" rarely has a fast answer" },
      { title: "Budgets that exist on paper only", desc: "Departments spend without a real-time check" },
    ],
    stat: {
      label: "Where control breaks down",
      rows: [
        { label: "Purchases approved after the money moved", value: "R 64,200" },
        { label: "Department budgets overrun", value: "R 22,900" },
        { label: "Spend with no clear approver", value: "R 31,500" },
      ],
      footerLabel: "With Ovasyt, this quarter",
      footerValue: "R 0 unsigned-off",
    },
  },
  {
    accent: "#8b5cf6",
    kicker: "For South African SMEs",
    headline: [
      { text: "Stop running your business " },
      { text: "through WhatsApp.", accent: true },
    ],
    image: slideBg4.url,
    problems: [
      { title: "Approvals lost in group chats", desc: "No record, no structure, no accountability" },
      { title: "Invoices typed in by hand", desc: "Manual capture means manual mistakes" },
      { title: "Suppliers calling to chase payment", desc: "Because nobody can tell them the status" },
    ],
    stat: {
      label: "What the chaos costs you",
      rows: [
        { label: "Hours spent chasing suppliers", value: "23 hrs / month" },
        { label: "Invoices typed in by hand", value: "140 / month" },
        { label: "Average approval delay", value: "4.5 days" },
      ],
      footerLabel: "With Ovasyt, every month",
      footerValue: "20+ hours back",
    },
  },
  {
    accent: "#06b6d4",
    kicker: "For South African SMEs",
    headline: [
      { text: "Ovasyt usually pays for itself " },
      { text: "in unclaimed VAT alone.", accent: true },
    ],
    image: slideBg5.url,
    problems: [
      { title: "Valid VAT claims, missed", desc: "Often over one missing invoice detail" },
      { title: "Claims never checked before filing", desc: "Nobody catches it until it's too late" },
      { title: "Money left on the table, quarter after quarter", desc: "That should have come back to the business" },
    ],
    stat: {
      label: "What's sitting unclaimed",
      rows: [
        { label: "VAT input claims rejected by SARS", value: "R 18,460" },
        { label: "Claims never submitted at all", value: "R 12,300" },
        { label: "Total recoverable last quarter", value: "R 30,760" },
      ],
      footerLabel: "With Ovasyt, this quarter",
      footerValue: "R 0 left unclaimed",
    },
  },
];

const SLIDE_INTERVAL = 3000;

function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => setActive((i + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section
      className="relative overflow-hidden bg-[hsl(222_60%_8%)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Full-bleed background images (crossfade) */}
      {SLIDES.map((slide, i) => (
        <div
          key={`bg-${i}`}
          aria-hidden="true"
          className="absolute inset-0 transition-opacity duration-[1200ms] ease-out bg-cover bg-center"
          style={{
            backgroundImage: `url(${slide.image})`,
            opacity: i === active ? 1 : 0,
          }}
        />
      ))}
      {/* Dark tint + gradient so text stays readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(115deg, hsl(222 60% 8% / 0.94) 0%, hsl(222 55% 10% / 0.82) 45%, hsl(222 55% 10% / 0.55) 100%)",
        }}
      />
      {/* ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background:
            "radial-gradient(55% 55% at 82% 22%, hsl(222 70% 25% / 0.55), transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[620px] py-16">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={
              "grid lg:grid-cols-2 gap-10 lg:gap-14 items-center transition-opacity duration-700 " +
              (i === active
                ? "opacity-100 relative"
                : "opacity-0 absolute inset-0 px-4 sm:px-6 lg:px-8 py-16 pointer-events-none")
            }
            aria-hidden={i !== active}
          >
            {/* Left: copy */}
            <div className={i === active ? "animate-fade-in" : ""}>
              <div className="flex items-center gap-2 mb-5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: slide.accent }}
                />
                <span
                  className="text-xs font-mono font-semibold tracking-[0.2em] uppercase"
                  style={{ color: slide.accent }}
                >
                  {slide.kicker}
                </span>
              </div>

              <h2 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.05] tracking-tight text-white mb-8">
                {slide.headline.map((part, k) => (
                  <span key={k} style={part.accent ? { color: slide.accent } : undefined}>
                    {part.text}
                  </span>
                ))}
              </h2>

              <div className="space-y-3 max-w-xl">
                {slide.problems.map((p) => (
                  <div
                    key={p.title}
                    className="flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-sm"
                    style={{
                      borderColor: `${slide.accent}55`,
                      backgroundColor: `${slide.accent}12`,
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${slide.accent}26` }}
                    >
                      <X className="h-3.5 w-3.5" style={{ color: slide.accent }} />
                    </span>
                    <div>
                      <p className="font-semibold text-white leading-tight">{p.title}</p>
                      <p className="text-sm text-white/60 leading-snug">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup/company">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6">
                    Book a demo
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    See pricing
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: stat card with blended background image */}
            <div className="relative">
              <div
                className="relative rounded-2xl border p-6 sm:p-7 backdrop-blur-xl shadow-2xl"
                style={{
                  borderColor: `${slide.accent}66`,
                  background:
                    "linear-gradient(160deg, hsl(222 55% 15% / 0.62), hsl(222 60% 10% / 0.72))",
                }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slide.accent }} />
                  <span
                    className="text-[11px] font-mono font-semibold tracking-[0.18em] uppercase"
                    style={{ color: slide.accent }}
                  >
                    {slide.stat.label}
                  </span>
                </div>

                <div className="divide-y divide-white/10">
                  {slide.stat.rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-4 py-4">
                      <span className="text-sm text-white/75">{row.label}</span>
                      <span
                        className="font-mono font-bold text-base sm:text-lg whitespace-nowrap"
                        style={{ color: slide.accent }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-4">
                  <span className="text-sm font-semibold text-white">{slide.stat.footerLabel}</span>
                  <span className="font-mono font-bold text-emerald-400 whitespace-nowrap">
                    {slide.stat.footerValue}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Dot indicators */}
        <div className="relative z-10 mt-10 flex items-center justify-center gap-2.5">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === active ? "28px" : "8px",
                backgroundColor: i === active ? s.accent : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const COST_STATS = [
  { value: "R30k+", title: "Average input VAT lost", desc: "Claims every quarter due to incomplete invoices" },
  { value: "1 in 4", title: "Invoices made without formal approval", desc: "In businesses still running spend through WhatsApp and email" },
  { value: "3 days", title: "Average time finance teams spend", desc: "Reconstructing an audit trail when SARS or a board asks for it" },
];

const COMPARE_BAD = [
  "Purchases get made first, questioned later",
  "Invoices typed in by hand, errors and all",
  "VAT claims based on invoices that were never checked",
  "\"Who approved this?\" has no clear answer",
  "Suppliers call to ask if they've been paid",
  "Audit time means a scramble to dig up proof",
];

const COMPARE_GOOD = [
  "Every purchase is approved before money moves",
  "Invoices are scanned and validated automatically",
  "VAT claims backed by SARS-checked documentation",
  "Every decision logged against a name and a date",
  "Suppliers track their own payment status",
  "Audit prep means clicking \"export\"",
];

const FEATURES = [
  { title: "No more maverick spending", desc: "Every purchase goes through a proper approval chain before money moves — no exceptions, no surprises at month-end." },
  { title: "Faster, error-free invoices", desc: "Smart scanning reads your invoices and pulls out the detail, so nothing gets typed in twice or wrong." },
  { title: "Pay less VAT", desc: "Every invoice is verified against SARS rules, so you never miss a valid input VAT claim or submit a broken one." },
  { title: "Full audit trail", desc: "Every decision, document and payment is logged and accessible in one place — ready the moment an auditor asks." },
  { title: "Supplier accountability", desc: "Suppliers submit quotes and track payment status through their own dedicated portal — no more chasing calls." },
  { title: "Real-time visibility", desc: "Always know what's approved, outstanding and paid, without chasing your finance team for an update." },
];

const SCAN_ROWS = [
  { label: "Supplier VAT number", state: "Verified" },
  { label: "Tax invoice format", state: "Valid" },
  { label: "Line item description", state: "Complete" },
  { label: "VAT amount reconciled", state: "Matched" },
];

export default function LandingPage() {
  useRevealOnScroll();
  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Ovasyt | Procurement & Compliance for NGOs and NPOs"
        description="Ovasyt gives South African NGOs and NPOs procurement approvals, donor fund tracking, supplier management, invoice scanning and audit-ready compliance."
        path="/"
      />
      <SiteNav />
      <h1 className="sr-only">Ovasyt — Procurement & Compliance for South African NGOs and NPOs</h1>
      <main>
        <HeroCarousel />

      {/* Cost of doing nothing */}
      <section className="section-glow relative bg-gradient-to-b from-white via-[hsl(220_40%_98%)] to-white py-24">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="reveal text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● The real cost of doing nothing
          </p>
          <h2 className="reveal text-center text-3xl sm:text-4xl font-bold text-slate-900 mb-12">
            This is what <span className="gradient-text">"we'll sort it out later"</span> costs an SME
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {COST_STATS.map((s, i) => (
              <div
                key={s.title}
                className="reveal premium-glass p-7"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <p className="text-4xl font-extrabold gradient-text mb-3">{s.value}</p>
                <p className="font-semibold text-slate-800 mb-1">{s.title}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The difference isn't subtle */}
      <section className="section-glow relative bg-gradient-to-br from-[hsl(220_40%_97%)] via-white to-[hsl(225_50%_96%)] py-24">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="reveal text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● Before / after
          </p>
          <h2 className="reveal text-center text-3xl sm:text-4xl font-bold text-slate-900 mb-12">
            The difference isn't subtle
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="reveal rounded-2xl border border-red-200/70 bg-gradient-to-br from-red-50/80 to-white/70 backdrop-blur-xl p-7 shadow-[0_10px_40px_-20px_hsl(0_84%_60%/0.35)] hover:-translate-y-1 transition-all duration-300">
              <h3 className="flex items-center gap-2 font-semibold text-red-700 mb-5">
                <X className="h-5 w-5" /> Spreadsheets &amp; WhatsApp
              </h3>
              <ul className="space-y-3">
                {COMPARE_BAD.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-slate-700">
                    <X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="reveal rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white/70 backdrop-blur-xl p-7 shadow-[0_10px_40px_-20px_hsl(142_71%_45%/0.35)] hover:-translate-y-1 transition-all duration-300" style={{ transitionDelay: "80ms" }}>
              <h3 className="flex items-center gap-2 font-semibold text-emerald-700 mb-5">
                <Check className="h-5 w-5" /> Ovasyt
              </h3>
              <ul className="space-y-3">
                {COMPARE_GOOD.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Spend control features */}
      <section
        className="relative py-20 overflow-hidden bg-[hsl(222_60%_9%)]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${spendControlBg.url})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(222 60% 8% / 0.92) 0%, hsl(222 55% 10% / 0.82) 50%, hsl(222 60% 8% / 0.94) 100%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="reveal text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-white/80 mb-3">
            ● Why businesses choose Ovasyt
          </p>
          <h2 className="reveal text-center text-3xl sm:text-4xl font-bold text-white mb-12">
            Spend control that doesn't slow you down
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="reveal group rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-xl p-6 shadow-2xl hover:bg-white/[0.12] hover:border-primary/50 hover:-translate-y-1 transition-all duration-300"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-[hsl(265_70%_60%/0.3)] border border-white/20 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VAT scanning panel */}
      <section className="section-glow relative bg-gradient-to-b from-white via-[hsl(220_40%_98%)] to-[hsl(225_50%_96%)] py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-2 items-center">
          <div className="reveal">
            <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
              ● VAT savings
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Every invoice, <span className="gradient-text">SARS-checked</span> before it's filed
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6 max-w-lg">
              Most businesses under-claim input VAT simply because invoices are
              missing SARS-required detail. Ovasyt reads every invoice, validates
              it against those requirements the moment it lands, and flags what's
              incomplete — so your bookkeeper gets a clean, defensible claim.
            </p>
            <Link to="/signup/company">
              <Button className="group bg-gradient-to-r from-primary to-[hsl(265_70%_58%)] hover:shadow-lg hover:shadow-primary/40 hover:scale-[1.03] text-primary-foreground font-semibold transition-all">
                See invoice scanning <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
          <div className="reveal premium-glass p-7" style={{ transitionDelay: "100ms" }}>
            <p className="text-xs font-mono font-semibold tracking-[0.18em] uppercase text-primary mb-5">
              ● Invoice check
            </p>
            <div className="divide-y divide-slate-100">
              {SCAN_ROWS.map((r, i) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between py-4 group hover:pl-1 transition-all"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <span className="text-sm text-slate-700">{r.label}</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 group-hover:scale-105 transition-transform">
                    <Check className="h-4 w-4" /> {r.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="section-glow relative bg-gradient-to-br from-white via-[hsl(225_50%_97%)] to-white py-24">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="reveal inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-mono font-semibold tracking-[0.18em] uppercase text-primary">Real results</span>
          </div>
          <blockquote className="reveal text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
            "We found three months of unclaimed VAT in our first week on Ovasyt.
            <span className="gradient-text"> It paid for the platform before we'd even finished onboarding.</span>"
          </blockquote>
          <p className="reveal mt-6 text-sm text-slate-500">— Finance lead, manufacturing SME, Gauteng</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-white to-[hsl(220_40%_96%)] pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="reveal relative overflow-hidden rounded-3xl px-8 py-16 text-center border border-white/10 shadow-[0_30px_80px_-30px_hsl(225_73%_57%/0.5)]"
            style={{
              background:
                "linear-gradient(135deg, hsl(222 60% 10%) 0%, hsl(240 55% 16%) 50%, hsl(265 55% 18%) 100%)",
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-70 pointer-events-none"
              style={{
                background:
                  "radial-gradient(50% 60% at 20% 20%, hsl(225 73% 60% / 0.35), transparent 70%), radial-gradient(50% 60% at 80% 80%, hsl(265 70% 60% / 0.35), transparent 70%)",
              }}
            />
            <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 mb-5 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-[11px] font-mono tracking-[0.18em] uppercase text-white/80">SARS &amp; POPIA aligned</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Stop guessing where the money went.
            </h2>
            <p className="text-white/70 max-w-xl mx-auto mb-8">
              Book a 15-minute walkthrough and see exactly how Ovasyt would handle
              your team's purchases, approvals and invoices.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/signup/company">
                <Button size="lg" className="group bg-gradient-to-r from-primary to-[hsl(265_70%_58%)] hover:shadow-lg hover:shadow-primary/50 hover:scale-[1.03] text-primary-foreground font-semibold px-8 transition-all">
                  Book a demo <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur">
                  See pricing
                </Button>
              </Link>
            </div>
            </div>
          </div>
        </div>
      </section>
      </main>
      <SiteFooter />
    </div>
  );
}
