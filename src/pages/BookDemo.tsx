import { Link } from "react-router-dom";
import {
  ArrowRight,
  Wallet,
  Workflow,
  ScanLine,
  LineChart,
  ShieldCheck,
  Check,
  Clock,
  Video,
  CalendarCheck,
  Sparkles,
  Mail,
} from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";
import { Button } from "@/components/ui/button";

import { BOOKING_URL } from "@/lib/booking";

export { BOOKING_URL };

const FEATURES = [
  {
    icon: Wallet,
    title: "Recover Lost VAT",
    body: "Discover where VAT claims are being missed and how Ovasyt helps reduce rejected submissions.",
  },
  {
    icon: Workflow,
    title: "Automate Procurement",
    body: "See purchase requests, approvals, invoices and payments flow automatically.",
  },
  {
    icon: ScanLine,
    title: "AI Invoice Processing",
    body: "Watch AI extract supplier invoices and supporting documents in seconds.",
  },
  {
    icon: LineChart,
    title: "Financial Visibility",
    body: "Track commitments, invoices and supplier payments from one dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance",
    body: "See how Ovasyt prepares your business for SARS compliance and audits.",
  },
];

const AGENDA = [
  { step: "Introduction", desc: "Meet the team and set the scope for the session." },
  { step: "Business Challenges", desc: "We listen first — where procurement and VAT currently break down." },
  { step: "Live Product Demo", desc: "A guided walkthrough using scenarios from your organisation." },
  { step: "Questions & Answers", desc: "Ask anything — compliance, security, rollout, integrations." },
  { step: "Pricing Discussion", desc: "Transparent plans and what implementation looks like." },
];

const ATTENDEES = [
  "Finance Managers",
  "Procurement Officers",
  "Business Owners",
  "CFOs",
  "Municipalities",
  "Government Departments",
  "SMEs",
];

const OUTCOMES = [
  "Reduce procurement administration",
  "Improve invoice accuracy",
  "Recover missed VAT",
  "Eliminate spreadsheet tracking",
  "Gain real-time financial insight",
];

const REASSURANCE = [
  { icon: Sparkles, text: "The demo is completely free." },
  { icon: Check, text: "No software installation required." },
  { icon: Video, text: "Hosted online via Google Meet." },
  { icon: CalendarCheck, text: "You'll receive a calendar invitation immediately after booking." },
];

function BookingButton({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <Button
      asChild
      size="lg"
      className={`group bg-gradient-to-r from-primary to-[hsl(200_90%_52%)] text-primary-foreground font-semibold px-8 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.03] transition-all ${className}`}
    >
      <a href={BOOKING_URL} target="_blank" rel="noreferrer noopener">
        {label}
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </a>
    </Button>
  );
}

export default function BookDemo() {
  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Book a Demo | Ovasyt Procurement & VAT Platform"
        description="Book a free 15-minute Ovasyt demo. See VAT recovery, procurement automation, AI invoice processing and SARS-ready compliance built for South African organisations."
        path="/book-demo"
      />
      <SiteNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-[hsl(222_47%_9%)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 60% at 15% 0%, hsl(225 73% 57% / 0.35), transparent 70%), radial-gradient(50% 60% at 90% 100%, hsl(200 90% 55% / 0.25), transparent 70%)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
            <p className="text-xs font-mono font-semibold tracking-[0.22em] uppercase text-[hsl(200_90%_65%)] mb-4">
              ● Book a demo
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.05] max-w-3xl">
              Book Your Live{" "}
              <span className="bg-gradient-to-r from-[hsl(200_90%_62%)] to-primary bg-clip-text text-transparent">
                Ovasyt Demo
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl leading-relaxed">
              See how Ovasyt helps South African NPOs recover missed VAT,
              automate procurement, and gain complete financial visibility.
            </p>
            <p className="mt-4 text-white/60 max-w-2xl">
              <span className="font-semibold text-white">No sales pressure.</span>{" "}
              Just a live walkthrough tailored to your organisation.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <BookingButton label="Schedule My Demo" />
              <Link to="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur"
                >
                  See pricing
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[hsl(200_90%_65%)]" /> 15 minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-4 w-4 text-[hsl(200_90%_65%)]" /> Google Meet
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Free, no obligation
              </span>
            </div>
          </div>
        </section>

        {/* What you'll see */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            What you'll see
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl">
            A live tour of the workflows that matter most to finance and
            procurement teams.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border/60 bg-white/70 backdrop-blur-xl p-6 shadow-[0_20px_60px_-40px_hsl(225_73%_57%/0.5)] hover:-translate-y-1 hover:shadow-[0_24px_70px_-35px_hsl(225_73%_57%/0.55)] transition-all"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-[hsl(200_90%_52%)]/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Agenda */}
        <section className="bg-gradient-to-b from-white via-[hsl(220_40%_97%)] to-white border-y border-border/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
                <Clock className="h-3.5 w-3.5" /> 15 minutes
              </span>
              <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                What happens during the demo
              </h2>
              <p className="mt-3 text-slate-600 max-w-md">
                A focused half hour — structured so you leave with clear answers,
                not a brochure.
              </p>
            </div>

            <ol className="relative border-l border-border pl-6 space-y-5">
              {AGENDA.map(({ step, desc }, i) => (
                <li key={step} className="relative">
                  <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground ring-4 ring-background">
                    {i + 1}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-slate-900 inline-flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {step}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who should attend + why book */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-white/70 backdrop-blur-xl p-7 shadow-[0_20px_60px_-40px_hsl(225_73%_57%/0.5)]">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Who should attend?
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {ATTENDEES.map((a) => (
                <li
                  key={a}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700"
                >
                  <Check className="h-3.5 w-3.5 text-primary" />
                  {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/60 bg-white/70 backdrop-blur-xl p-7 shadow-[0_20px_60px_-40px_hsl(225_73%_57%/0.5)]">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Why book?
            </h2>
            <ul className="mt-6 space-y-3">
              {OUTCOMES.map((o) => (
                <li key={o} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm sm:text-base">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Before booking */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-6">
            Before booking
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REASSURANCE.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="rounded-xl border border-border/60 bg-white p-5 shadow-sm"
              >
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-[hsl(222_47%_9%)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 0%, hsl(225 73% 57% / 0.35), transparent 70%)",
            }}
          />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Ready to see Ovasyt in action?
            </h2>
            <p className="mt-4 text-white/70 max-w-2xl mx-auto">
              See how Ovasyt can simplify procurement, improve compliance, and
              help recover money that often goes unclaimed.
            </p>
            <div className="mt-8 flex justify-center">
              <BookingButton label="Book My Free Demo" />
            </div>
            <p className="mt-10 text-sm text-white/60">
              Need to speak with us instead?{" "}
              <Link to="/contact" className="font-semibold text-white hover:text-[hsl(200_90%_65%)] transition-colors">
                Contact sales
              </Link>{" "}
              <span className="mx-1 text-white/30">·</span>
              <a
                href="mailto:connect@ovasyt.tech"
                className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-[hsl(200_90%_65%)] transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                connect@ovasyt.tech
              </a>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}