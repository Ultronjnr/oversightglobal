import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";
import { Link } from "react-router-dom";
import { ShieldCheck, Sparkles, Users, Target } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="About Ovasyt | Procurement & Compliance for South African NGOs"
        description="Ovasyt is a South African procurement, VAT and Section 18A compliance platform built for NGOs, NPOs and SMEs. Learn about our mission, team, and product."
        path="/about"
      />
      <SiteNav />
      <main>
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● About Ovasyt
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-6">
            Built in South Africa, for South African compliance.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl">
            Ovasyt is a procurement, VAT and Section 18A compliance platform
            built for NGOs, NPOs and SMEs operating under SARS rules. We
            replace spreadsheets and email chains with a single audit-ready
            workflow so finance teams can approve faster, reclaim more VAT,
            and prove every rand of donor spend.
          </p>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 grid gap-6 sm:grid-cols-2">
          {[
            {
              icon: Target,
              title: "Our mission",
              body:
                "Give every South African NGO the same audit-ready procurement and receipting discipline the biggest organisations rely on — without the enterprise price tag.",
            },
            {
              icon: ShieldCheck,
              title: "Compliance first",
              body:
                "Every feature ships with SARS in mind: VAT-valid invoices, sequential 18A receipts, IT3(d) exports, and immutable audit trails.",
            },
            {
              icon: Users,
              title: "Who we serve",
              body:
                "Public-benefit organisations, faith-based NPOs, community-development trusts, and SMEs handling donor or grant funding in South Africa.",
            },
            {
              icon: Sparkles,
              title: "What makes us different",
              body:
                "We focus on the messy middle — approvals, evidence, and reconciliation — not just accounting. Ovasyt captures the transaction the moment it happens.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border/60 bg-card/60 p-6"
            >
              <div className="rounded-lg bg-primary/10 p-2 w-fit mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-8 sm:p-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Ready to see it in action?
            </h2>
            <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
              Book a walkthrough or explore pricing built for South African
              non-profits and SMEs.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Book a demo
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}