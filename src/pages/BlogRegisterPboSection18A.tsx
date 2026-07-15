import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";

export default function BlogRegisterPboSection18A() {
  const url = "https://ovasyt.tech/blog/how-to-register-pbo-section-18a";
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "How to Register a PBO and Get Section 18A Approval in South Africa",
    description:
      "A step-by-step guide to SARS PBO registration and Section 18A approval for South African NGOs — required documents, timelines, and compliance obligations.",
    author: { "@type": "Organization", name: "Ovasyt" },
    publisher: { "@type": "Organization", name: "Ovasyt" },
    datePublished: "2026-07-15",
    dateModified: "2026-07-15",
    mainEntityOfPage: url,
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a Section 18A receipt?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "A Section 18A receipt is a tax certificate issued by a SARS-approved Public Benefit Organisation (PBO) with 18A status. It allows the donor to claim a deduction of the donation against taxable income, up to 10% per tax year, provided the donation funds an approved Public Benefit Activity.",
        },
      },
      {
        "@type": "Question",
        name: "How do I register a PBO with SARS?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Submit form EI 1 with a certified founding document (NPC MOI, trust deed, or NPO constitution), the IDs of at least three unconnected fiduciaries, and proof of banking and address to the SARS Tax Exemption Unit. Approval typically takes 8–12 weeks.",
        },
      },
      {
        "@type": "Question",
        name: "Is 18A status separate from PBO status?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. PBO status grants income-tax exemption. Section 18A status is an additional approval that lets the PBO issue donor tax certificates. You apply for 18A on the same EI 1 form, but only certain Part II Ninth Schedule activities qualify.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="How to Register a PBO and Get Section 18A Approval | Ovasyt"
        description="Step-by-step SARS guide for South African NGOs: PBO registration, Section 18A approval, required documents, and ongoing compliance obligations."
        path="/blog/how-to-register-pbo-section-18a"
        type="article"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>
      <SiteNav />
      <main>
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-600">
            <Link to="/" className="hover:text-slate-900">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/blog" className="hover:text-slate-900">Guides</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-900">PBO registration & Section 18A</span>
          </nav>

          <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● SARS compliance guide
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight mb-4">
            How to Register a PBO and Get Section 18A Approval in South Africa
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed mb-10">
            Registering as a Public Benefit Organisation (PBO) with SARS unlocks
            income-tax exemption. Section 18A approval goes further — it lets
            you issue tax-deductible donor receipts. Here's the full process,
            the documents you need, and the compliance obligations that follow.
          </p>

          <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              What is a Section 18A receipt?
            </h2>
            <p>
              A Section 18A receipt is a tax certificate issued by a SARS-approved
              PBO that has been granted 18A status. It allows the donor —
              individual or company — to deduct the donation from taxable income,
              capped at 10% per tax year, with the excess rolled forward.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              Step 1 — Set up the legal entity
            </h2>
            <p>
              Before SARS will consider a PBO application, the organisation must
              exist as one of:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>A Non-Profit Company (NPC) registered with the CIPC.</li>
              <li>A trust registered with the Master of the High Court.</li>
              <li>A voluntary association with a written constitution.</li>
            </ul>
            <p>
              The founding document must contain the clauses SARS requires:
              non-profit purpose, at least three unconnected fiduciaries,
              prohibition on distributing income to members, and a
              dissolution clause donating remaining assets to another PBO.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              Step 2 — Prepare the EI 1 application
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Completed and signed <strong>form EI 1</strong>.</li>
              <li>Certified copy of the founding document (MOI, trust deed, or constitution).</li>
              <li>Certified IDs of all fiduciaries — minimum three, unconnected.</li>
              <li>Written undertaking (form EI 2) signed by fiduciaries.</li>
              <li>Proof of business address and banking details.</li>
              <li>NPO registration certificate from the DSD (recommended, not mandatory).</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              Step 3 — Apply for Section 18A on the same form
            </h2>
            <p>
              Section B of the EI 1 is where you request 18A status. Only
              activities listed in <strong>Part II of the Ninth Schedule</strong>
              qualify — welfare and humanitarian, healthcare, education and
              development, conservation, and religion (limited). If your PBO
              also runs non-qualifying activities, you must ring-fence donation
              income and use it exclusively for approved PBAs.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              Step 4 — Submit and wait
            </h2>
            <p>
              File the application with the SARS Tax Exemption Unit in
              Pretoria, by email or through SARS Online Query. Turnaround is
              typically 8–12 weeks. On approval, SARS issues a PBO reference
              number and, if granted, a separate 18A reference — both must
              appear on every donor certificate.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              Step 5 — Ongoing compliance
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Annual IT12EI income-tax return.</li>
              <li>IT3(d) third-party return listing every 18A receipt issued (since March 2023).</li>
              <li>Sequential receipt numbering and donor tax-reference-number capture.</li>
              <li>Retention of records for at least five years.</li>
              <li>Notify SARS within 30 days of any change to fiduciaries or founding document.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              How Ovasyt helps
            </h2>
            <p>
              Ovasyt's donations module handles the parts that most often trip
              up new PBOs: sequential 18A receipt numbering, mandatory donor tax
              number capture, tamper-evident receipts with QR verification, and
              an IT3(d)-ready export at year-end.
            </p>
            <p>
              <Link to="/blog/section-18a-donations-in-kind" className="text-primary font-semibold hover:underline">
                Next: Section 18A receipts for donations in kind →
              </Link>
            </p>

            <hr className="my-8 border-slate-200" />
            <p className="text-xs text-slate-500">
              This guide is informational and doesn't replace tax advice. Confirm
              specifics with a registered tax practitioner before submitting an
              EI 1 application.
            </p>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}