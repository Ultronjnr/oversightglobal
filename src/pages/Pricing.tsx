import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

const PLANS = [
  {
    name: "Starter",
    price: "R 1 290",
    period: "/month",
    blurb: "For small teams formalising their first approval process.",
    cta: "Start free trial",
    to: "/signup/company",
    popular: false,
    features: [
      "Up to 10 users",
      "Unlimited purchase requests",
      "2-step approval chains",
      "AI invoice scanning (100/mo)",
      "Supplier portal access",
      "Standard audit trail",
    ],
  },
  {
    name: "Growth",
    price: "R 3 450",
    period: "/month",
    blurb: "For growing businesses managing multiple departments or sites.",
    cta: "Book a demo",
    to: "/signup/company",
    popular: true,
    features: [
      "Up to 50 users",
      "Unlimited purchase requests",
      "Multi-level, conditional approvals",
      "AI invoice scanning (unlimited)",
      "SARS VAT verification",
      "Supplier portal + payment status",
      "Full exportable audit trail",
      "Departmental budgets",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "For multi-entity businesses with complex approval needs.",
    cta: "Talk to sales",
    to: "/signup/company",
    popular: false,
    features: [
      "Unlimited users",
      "Multi-entity & multi-currency",
      "Custom approval logic",
      "Priority AI processing",
      "Dedicated account manager",
      "API & accounting integrations",
      "Custom audit reporting",
    ],
  },
];

const COMPARE: { feature: string; starter: string; growth: string; enterprise: string }[] = [
  { feature: "Users included", starter: "10", growth: "50", enterprise: "Unlimited" },
  { feature: "AI invoice scans", starter: "100 / month", growth: "Unlimited", enterprise: "Unlimited" },
  { feature: "Approval chain depth", starter: "2 steps", growth: "Unlimited", enterprise: "Unlimited + conditional" },
  { feature: "SARS VAT verification", starter: "—", growth: "✓", enterprise: "✓" },
  { feature: "Supplier portal", starter: "✓", growth: "✓", enterprise: "✓" },
  { feature: "Departmental budgets", starter: "—", growth: "✓", enterprise: "✓" },
  { feature: "Accounting integrations", starter: "—", growth: "1 included", enterprise: "Unlimited" },
  { feature: "Dedicated account manager", starter: "—", growth: "—", enterprise: "✓" },
];

const FAQ = [
  { q: "Is there a free trial?", a: "Yes — every plan starts with a 14-day free trial, no card required. You'll have full access so you can run real purchases through it before committing." },
  { q: "Can I change plans later?", a: "Absolutely. You can move up or down a plan at any time, and we'll prorate the difference on your next invoice." },
  { q: "Is there a setup fee?", a: "No. Pricing is month-to-month with no setup costs and no long-term contract on Starter and Growth plans." },
  { q: "What counts as an \"AI scan\"?", a: "Every invoice or quote that Ovasyt reads and validates counts as one scan, regardless of length or supplier." },
];

function Cell({ value }: { value: string }) {
  if (value === "✓") return <Check className="h-4 w-4 text-emerald-600 mx-auto" />;
  if (value === "—") return <Minus className="h-4 w-4 text-slate-300 mx-auto" />;
  return <span className="text-sm text-slate-700">{value}</span>;
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

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
            Every plan includes the full approval chain, AI invoice scanning, and a
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

      <SiteFooter />
    </div>
  );
}
