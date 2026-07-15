import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

const PLANS = [
  {
    name: "Platform",
    price: "R1 999",
    period: "/month",
    blurb: "For NPOs that run their own books — or whose accountant works straight off their Ovasyt data.",
    cta: "Start free trial",
    to: "/signup/company",
    popular: false,
    features: [
      "5 users (Admin, Finance Manager, HOD, Team Member)",
      "Full approval chain: Request → Approve → Invoice → Paid",
      "Invoice scanning (150/month)",
      "SARS tax invoice validation",
      "Project & donor fund tracking",
      "30 donor profiles",
      "Donor Reports",
      "Project Reports",
      "Supplier portal",
      "Invite up to 50 suppliers",
      "Request & receive quotes inside Ovasyt",
      "Section 18A receipt generation (50/year)",
      "10 GB storage",
      "Standard audit trail",
    ],
  },
  {
    name: "Funder-Ready",
    price: "R5 998",
    period: "/month",
    blurb: "Everything in Platform — plus we carry your compliance. Never think about SARS or year-end again.",
    cta: "Book a demo",
    to: "/signup/company",
    popular: true,
    features: [
      "Everything in Platform",
      "10 users",
      "Unlimited donor profiles",
      "150 supplier accounts",
      "Invoice scanning (300/month)",
      "25 GB storage",
      "Unlimited Section 18A receipts",
      "Monthly bookkeeping",
      "Independently reviewed Annual Financial Statements",
      "Income tax submissions",
      "Priority support",
      "Guided onboarding",
      "Staff training",
    ],
  },
  {
    name: "Tailored",
    price: "Custom",
    period: "",
    blurb: "For NPO networks, federations and multi-entity organisations with complex funder requirements.",
    cta: "Talk to sales",
    to: "/signup/company",
    popular: false,
    features: [
      "Unlimited users",
      "Multi-entity support",
      "Custom approval logic",
      "Reviewed or audited AFS",
      "Priority processing",
      "Dedicated account manager",
      "Supplier accounts as agreed",
      "Custom storage",
      "Custom integrations",
    ],
  },
];

const COMPARE: { feature: string; starter: string; growth: string; enterprise: string }[] = [
  { feature: "Users Included", starter: "5", growth: "10", enterprise: "Unlimited" },
  { feature: "Supplier Accounts", starter: "50", growth: "150", enterprise: "As agreed" },
  { feature: "Invoice Scans", starter: "150/month", growth: "300/month", enterprise: "Unlimited" },
  { feature: "Donor Profiles", starter: "30", growth: "Unlimited", enterprise: "Unlimited" },
  { feature: "Storage", starter: "10 GB", growth: "25 GB", enterprise: "As agreed" },
  { feature: "Approval Chain", starter: "Full", growth: "Full", enterprise: "Full + Custom Logic" },
  { feature: "Project & Donor Fund Tracking", starter: "✓", growth: "✓", enterprise: "✓" },
  { feature: "Donor Reports", starter: "✓", growth: "✓", enterprise: "✓" },
  { feature: "Project Reports", starter: "✓", growth: "✓", enterprise: "✓" },
  { feature: "Supplier Portal", starter: "✓", growth: "✓", enterprise: "✓" },
  { feature: "SARS Invoice Validation", starter: "✓", growth: "✓", enterprise: "✓" },
  { feature: "Section 18A Receipts", starter: "50/year", growth: "Unlimited", enterprise: "Unlimited" },
  { feature: "Monthly Bookkeeping", starter: "—", growth: "✓", enterprise: "✓" },
  { feature: "Independently Reviewed AFS", starter: "—", growth: "✓", enterprise: "✓ (or Audited)" },
  { feature: "Income Tax Submissions", starter: "—", growth: "✓", enterprise: "✓" },
  { feature: "Support", starter: "Next Business Day", growth: "Priority Same Day", enterprise: "Dedicated Account Manager" },
  { feature: "Onboarding", starter: "Standard + Setup Call", growth: "Guided + Staff Training", enterprise: "White-glove" },
  { feature: "Entities", starter: "1", growth: "1", enterprise: "Multiple" },
];

const ADDONS = [
  {
    name: "Additional Users",
    price: "R39",
    period: "/user/month",
    blurb:
      "Add additional HOD and Team Member users. Each organisation includes one Admin and one Finance Manager by design to maintain segregation of duties and a single point of accountability.",
  },
  {
    name: "Unlimited Section 18A Receipts",
    price: "R49",
    period: "/month",
    blurb:
      "Platform includes 50 receipts annually. Upgrade to unlimited generation at any time. Already included in Funder-Ready.",
  },
];

const FAQ = [
  { q: "Is there a free trial?", a: "Yes — Platform starts with a 14-day free trial, no card required. Run real purchases through the system and generate your first donor report before committing. The trial applies to Platform only." },
  { q: "Can I change plans later?", a: "Absolutely. Upgrade any time — most organisations move to Funder-Ready the day a funder asks for independently reviewed financials. We'll prorate the difference on your next invoice." },
  { q: "Do I need Funder-Ready, or is Platform enough?", a: "Platform is ideal if your own accountant or bookkeeper manages compliance — it gives them perfect, allocated, audit-ready data to work from. Funder-Ready is for organisations who'd rather have Ovasyt handle bookkeeping, tax submissions and year-end compliance." },
  { q: "What counts as a \"scan\"?", a: "Every invoice or receipt that Ovasyt reads, checks against SARS tax invoice requirements and captures counts as one scan, regardless of length or supplier." },
  { q: "Why only one Finance Manager and one Admin?", a: "By design. One ultimate approver and one account owner means clean segregation of duties and a single point of accountability — exactly what auditors and funders look for. Add as many HODs and Team Members as you need at R39 per user per month." },
  { q: "How do supplier accounts work?", a: "Your Admin invites suppliers to open a free Ovasyt account. Your Finance Manager sends quote requests in-platform, suppliers respond in-platform, and the full chain of custody — requisition, approvals, quotes, selection, invoice, payment — stays in one auditable line." },
  { q: "We joined mid-financial-year — what about the earlier months?", a: "On Funder-Ready, Ovasyt offers a once-off historical bookkeeping catch-up service, quoted after a quick look at your records, so your first Annual Financial Statements cover the full year." },
  { q: "Are prices VAT inclusive?", a: "Yes. All prices are in ZAR including VAT where applicable, billed monthly by debit order. 30 days' notice to cancel, with no long-term contracts." },
];

function Cell({ value }: { value: string }) {
  if (value === "✓") return <Check className="h-4 w-4 text-emerald-600 mx-auto" />;
  if (value === "—") return <Minus className="h-4 w-4 text-slate-300 mx-auto" />;
  return <span className="text-sm text-slate-700">{value}</span>;
}

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
      <SiteNav />
      <main>
      {/* Header */}
      <section className="bg-slate-50 pt-20 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-4">
            ● Pricing
          </p>
          <h1 className="text-center text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
            Plans that scale with your spend, not your headcount
          </h1>
          <p className="text-center text-slate-600 max-w-2xl mx-auto mb-14">
            Every plan includes the full approval chain, invoice scanning, and a
            complete audit trail. No setup fees, no lock-in contracts.
          </p>

          <div className="grid gap-6 lg:grid-cols-3 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={
                  "relative rounded-2xl bg-white p-7 shadow-sm " +
                  (plan.popular
                    ? "border-2 border-primary shadow-lg lg:-mt-4 lg:mb-4"
                    : "border border-slate-200")
                }
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="font-bold text-slate-900 mb-4">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">{plan.price}</span>
                  {plan.period && <span className="text-sm text-slate-500 font-mono">{plan.period}</span>}
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">{plan.blurb}</p>
                <ul className="space-y-3 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to={plan.to} className="block">
                  <Button
                    className={
                      "w-full font-semibold " +
                      (plan.popular
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : "")
                    }
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● Compare plans
          </p>
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-slate-900 mb-12">
            Every detail, side by side
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-mono uppercase tracking-wide text-slate-400">
                  <th className="text-left font-semibold py-4">Feature</th>
                  <th className="text-center font-semibold py-4">Starter</th>
                  <th className="text-center font-semibold py-4">Growth</th>
                  <th className="text-center font-semibold py-4">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.feature} className="border-b border-slate-100">
                    <td className="py-4 text-sm font-semibold text-slate-800">{row.feature}</td>
                    <td className="py-4 text-center"><Cell value={row.starter} /></td>
                    <td className="py-4 text-center"><Cell value={row.growth} /></td>
                    <td className="py-4 text-center"><Cell value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs text-slate-500 text-center">
            *Available to SARS-approved Section 18A organisations.
          </p>
        </div>
      </section>

      {/* Add-ons */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● Add-ons
          </p>
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Extend your Platform plan as you grow
          </h2>
          <p className="text-center text-slate-600 max-w-2xl mx-auto mb-12">
            Optional extras for organisations on the Platform plan.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {ADDONS.map((addon) => (
              <div
                key={addon.name}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <h3 className="font-bold text-slate-900 mb-4">{addon.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">{addon.price}</span>
                  {addon.period && <span className="text-sm text-slate-500 font-mono">{addon.period}</span>}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{addon.blurb}</p>
              </div>
            ))}
          </div>
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
                <p className="text-sm text-slate-500 leading-relaxed">{item.a}</p>
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
