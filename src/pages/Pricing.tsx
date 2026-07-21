import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";

const PLATFORM_FEATURES = [
  "Everything on the features page",
  "5 users · 150 scans · 30 donors",
  "50 suppliers · 18A · 10 GB",
];

const ADDONS = [
  { name: "Monthly Bookkeeping", price: "from R1 999/mo" },
  { name: "Independently Reviewed AFS", price: "from R1 499/mo" },
  { name: "Income Tax Submissions", price: "from R499/mo" },
  { name: "Additional users", price: "R39/user/mo" },
  { name: "Extra suppliers (+50)", price: "R99/mo" },
  { name: "Unlimited 18A receipts", price: "R49/mo" },
];

const CUSTOM_FEATURES = [
  "NPO networks & federations",
  "Multi-entity organisations",
  "Special funder requirements",
  "Reviewed or audited AFS",
  "Custom users & volumes",
];

const FAQ = [
  { q: "Is there a free trial?", a: "Yes — Platform starts with a 14-day free trial, no card required. Run real purchases through the system and generate your first donor report before committing." },
  { q: "How do add-ons work?", a: "Activate any add-on from the Billing section of your account. Compliance add-ons show minimum pricing — confirmed after a short scoping call (volume, entity type, historical months)." },
  { q: "What counts as a scan?", a: "Every invoice or receipt Ovasyt reads, checks against SARS tax invoice requirements and captures counts as one scan — regardless of length or supplier." },
  { q: "Why only one Finance Manager and one Admin?", a: "By design. One ultimate approver and one account owner means clean segregation of duties and a single point of accountability. Add HODs and Team Members at R39/user/mo." },
  { q: "How do supplier accounts work?", a: "Your Admin invites suppliers to open a free Ovasyt account. Your Finance Manager sends quote requests in-platform, suppliers respond in-platform — the full chain of custody stays in one auditable line." },
  { q: "Are prices VAT inclusive?", a: "Yes. All prices are in ZAR including VAT where applicable, billed monthly by debit order. 30 days' notice to cancel, with no long-term contracts." },
];

export default function Pricing() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Pricing — Ovasyt NGO Procurement & Compliance Plans"
        description="One Ovasyt Platform plan at R1 999/month, with modular compliance add-ons. Custom quotes for NPO networks, federations and multi-entity organisations."
        path="/pricing"
      />
      <SiteNav />
      <main>
        {/* Header */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-[hsl(220_40%_96%)] pt-20 pb-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(50% 60% at 15% 0%, hsl(225 73% 57% / 0.10), transparent 70%), radial-gradient(50% 60% at 90% 100%, hsl(200 90% 55% / 0.10), transparent 70%)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-4">
              ● Pricing
            </p>
            <h1 className="text-center text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
              One platform. Add what you need, when you need it.
            </h1>
            <p className="text-center text-slate-600 max-w-2xl mx-auto mb-14">
              Start on Platform for R1 999/month. Activate compliance add-ons
              from inside your account as your organisation grows.
            </p>

            <div className="grid gap-6 lg:grid-cols-3 items-stretch">
              {/* Platform */}
              <div className="relative rounded-2xl bg-white border-2 border-primary p-7 shadow-[0_20px_60px_-30px_hsl(225_73%_57%/0.5)] flex flex-col">
                <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
                  Platform
                </p>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold text-slate-900 font-mono">R1 999</span>
                  <span className="text-sm text-slate-500 font-mono">/month</span>
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  The full software. Your team runs it — your accountant works
                  straight off your Ovasyt data.
                </p>
                <ul className="space-y-3 mb-7 flex-1">
                  {PLATFORM_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup/company" className="block">
                  <Button className="w-full font-semibold bg-primary hover:bg-primary/90 text-primary-foreground">
                    Free trial — 14 days, no card
                  </Button>
                </Link>
              </div>

              {/* Add-ons */}
              <div className="relative rounded-2xl bg-white border border-slate-200 p-7 shadow-sm flex flex-col">
                <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-slate-500 mb-3">
                  Add-ons
                </p>
                <p className="text-sm italic text-slate-500 mb-6">
                  Activated from the Billing section of your account
                </p>
                <ul className="space-y-4 mb-6 flex-1">
                  {ADDONS.map((addon, i) => (
                    <li key={addon.name}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-slate-900">{addon.name}</span>
                        <span className="text-sm font-mono text-primary whitespace-nowrap">
                          {addon.price}
                        </span>
                      </div>
                      {i === 2 && <div className="mt-4 border-t border-slate-100" />}
                    </li>
                  ))}
                </ul>
                <p className="text-xs italic text-slate-500 leading-relaxed">
                  Compliance add-ons show minimum pricing — confirmed after a
                  short scoping call (volume, entity type, historical months).
                </p>
              </div>

              {/* Custom */}
              <div className="relative rounded-2xl bg-slate-900 border border-slate-800 p-7 shadow-lg flex flex-col text-white">
                <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
                  Custom
                </p>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold text-white">Quoted</span>
                </div>
                <ul className="space-y-3 mb-7 flex-1">
                  {CUSTOM_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/contact" className="block">
                  <Button
                    variant="outline"
                    className="w-full font-semibold border-primary/60 text-white bg-transparent hover:bg-primary/20 hover:text-white"
                  >
                    Talk to us
                  </Button>
                </Link>
              </div>
            </div>

            <p className="mt-10 text-center text-sm text-slate-600">
              Most NPOs choose: Platform + full compliance stack — typically
              from <span className="font-semibold text-slate-900">R7 999/month</span> · All prices incl. VAT where applicable · monthly debit
              order · no lock-in
            </p>
            <p className="mt-3 text-center text-sm">
              <span className="font-semibold text-slate-900">Book a demo or start your trial:</span>{" "}
              <a href="tel:+27849231405" className="text-primary hover:underline font-mono">
                +27 84 923 1405
              </a>{" "}
              ·{" "}
              <a href="mailto:info@ovasyt.tech" className="text-primary hover:underline">
                info@ovasyt.tech
              </a>{" "}
              ·{" "}
              <Link to="/contact" className="text-primary hover:underline font-semibold">
                ovasyt.tech
              </Link>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-slate-50 py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
              ● FAQ
            </p>
            <h2 className="text-center text-3xl sm:text-4xl font-bold text-slate-900 mb-12">
              Pricing questions, answered
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold text-slate-900 mb-2">{item.q}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteFooter />
    </div>
  );
}
