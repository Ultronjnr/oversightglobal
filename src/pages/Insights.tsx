import { Link } from "react-router-dom";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";
import { ArrowRight, BookOpen } from "lucide-react";

const POSTS = [
  {
    title: "Best NPO bank accounts in South Africa (2026)",
    excerpt:
      "Compare FNB, Nedbank, Standard Bank, Absa and Capitec on NPO fees, setup, FICA requirements and audit-ready features.",
    to: "/blog/best-npo-bank-accounts-south-africa",
    tag: "NPO finance",
  },
  {
    title: "Section 18A receipts for donations in kind",
    excerpt:
      "Can non-cash donations receive a Section 18A receipt? SARS rules, valuation methods, and what a compliant certificate must show.",
    to: "/blog/section-18a-donations-in-kind",
    tag: "SARS compliance",
  },
  {
    title: "How to register a PBO and get Section 18A approval",
    excerpt:
      "A step-by-step SARS guide for South African NGOs: PBO registration, EI 1 documents, timelines, and ongoing compliance obligations.",
    to: "/blog/how-to-register-pbo-section-18a",
    tag: "Registration",
  },
];

export default function Insights() {
  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Insights & Guides | Ovasyt"
        description="Guides on Section 18A, VAT compliance and procurement discipline for South African NGOs, NPOs and SMEs. Practical, SARS-aligned, written for finance teams."
        path="/insights"
      />
      <SiteNav />
      <main>
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● Insights
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-6">
            Guides for finance and compliance teams.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl mb-10">
            Practical, SARS-aligned guides on Section 18A, PBO registration,
            VAT reclaim, procurement approvals, and audit readiness — written
            for the people running finance inside South African NGOs and SMEs.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {POSTS.map((post) => (
              <Link
                key={post.to}
                to={post.to}
                className="group rounded-xl border border-border/60 bg-card/80 p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-3">
                  <BookOpen className="h-4 w-4" />
                  {post.tag}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  {post.excerpt}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Read guide <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}