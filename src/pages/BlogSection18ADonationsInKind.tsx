import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";

export default function BlogSection18ADonationsInKind() {
  const url = "https://ovasyt.tech/blog/section-18a-donations-in-kind";
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Section 18A Receipts for Donations in Kind: A South African NGO Compliance Guide",
    description:
      "Can donations in kind receive a Section 18A receipt? A practical SARS-compliance guide for South African NGOs and PBOs issuing 18A certificates for non-cash donations.",
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
        name: "Can donations in kind receive a Section 18A receipt?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. A SARS-approved Public Benefit Organisation (PBO) with 18A status may issue a Section 18A receipt for a donation in kind (goods, stock, property or services rendered without a fee), provided the donation is used for an approved PBA activity and the receipt reflects a defensible fair-market value with supporting evidence.",
        },
      },
      {
        "@type": "Question",
        name: "How is the value of a non-cash donation determined for a Section 18A receipt?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Use fair market value on the date the donation is received. For new goods, that is usually the supplier invoice or replacement cost. For used goods, property, or specialised items, keep a written valuation, a comparable sale, or an independent appraisal on file — SARS may ask to see it.",
        },
      },
      {
        "@type": "Question",
        name: "What must a Section 18A receipt contain?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "The PBO's name, address and 18A reference number, a unique receipt number, the date of receipt, the donor's full name and address, the amount or a description and value of the donation in kind, and a statement that the donation will be used exclusively for approved PBA activities.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Section 18A Receipts for Donations in Kind | Ovasyt"
        description="Can donations in kind receive a Section 18A receipt? A SARS-compliance guide for South African NGOs and PBOs issuing 18A certificates for non-cash donations."
        path="/blog/section-18a-donations-in-kind"
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
            <span className="text-slate-900">Section 18A donations in kind</span>
          </nav>

          <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● SARS compliance guide
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight mb-4">
            Section 18A Receipts for Donations in Kind: A South African NGO Guide
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed mb-10">
            Can donations in kind receive a Section 18A receipt? Short answer:
            yes — but SARS is strict about what the certificate must show and
            how the value is justified. This is a practical guide for South
            African PBOs on issuing compliant 18A receipts for non-cash
            donations.
          </p>

          <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              What "donation in kind" means under Section 18A
            </h2>
            <p>
              A donation in kind is any bona fide donation that isn't cash —
              goods, trading stock, property, or (in limited cases) services
              rendered free of charge. Section 18A of the Income Tax Act allows
              an approved Public Benefit Organisation (PBO) with 18A status to
              issue a receipt that the donor can use to claim a deduction, up to
              10% of taxable income.
            </p>
            <p>
              The key requirement: the donation must be used exclusively for a
              Public Benefit Activity (PBA) listed in Part II of the Ninth
              Schedule. A donation in kind that will be resold or repurposed
              outside the PBO's approved PBA scope does not qualify.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              Can a donation in kind receive a Section 18A receipt?
            </h2>
            <p>
              Yes, provided three conditions are met:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>The organisation holds valid 18A approval from SARS.</li>
              <li>
                The donation is applied to an approved PBA — not on-sold for
                unrelated income.
              </li>
              <li>
                The receipt reflects a defensible fair-market value on the date
                of receipt, with evidence on file.
              </li>
            </ol>
            <p>
              Services rendered free of charge are the grey area: SARS generally
              disallows deductions for donated time or professional services
              unless there's a clear market rate and the service was invoiced
              and waived. When in doubt, don't issue an 18A receipt for
              time-based donations.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              How to value a non-cash donation
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>New goods:</strong> supplier invoice or replacement
                cost on the date of donation.
              </li>
              <li>
                <strong>Trading stock:</strong> the lower of cost or
                net-realisable value, per the donor's own accounting records.
              </li>
              <li>
                <strong>Used goods and equipment:</strong> a written valuation,
                comparable market sale, or independent appraisal.
              </li>
              <li>
                <strong>Property:</strong> a sworn valuation from a registered
                property valuer.
              </li>
            </ul>
            <p>
              Keep the supporting document with the receipt record. If SARS
              audits the donor and asks how the amount was determined, the PBO
              needs to be able to produce it.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              What a compliant Section 18A receipt must contain
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>The PBO's registered name, address, and 18A reference number.</li>
              <li>A unique, sequential receipt number.</li>
              <li>The date the donation was received.</li>
              <li>The donor's full name, address, and tax reference number (mandatory since March 2023).</li>
              <li>The nature of the donation — cash, or a specific description of the goods or property.</li>
              <li>The rand value assigned to the donation.</li>
              <li>
                The statement: "This receipt is issued for income tax purposes
                in terms of section 18A of the Income Tax Act, 1962, and the
                donation has been or will be used exclusively for the object of
                the PBO in carrying on the relevant public benefit activity."
              </li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              IT3(d) third-party reporting — new since 2023
            </h2>
            <p>
              Since 1 March 2023, every 18A-approved PBO must submit an IT3(d)
              return to SARS listing all 18A receipts issued during the tax
              year, including the donor's tax reference number. Donations in
              kind are reported the same way as cash donations — the rand value
              on the certificate is what SARS matches against the donor's
              claim.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              Common mistakes that trigger SARS pushback
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Issuing an 18A receipt with no valuation evidence for a used item.</li>
              <li>Missing the donor's tax reference number (required post-March 2023).</li>
              <li>Non-sequential receipt numbers, or duplicates.</li>
              <li>Receipting donated services without a defensible market rate.</li>
              <li>Applying the donation to non-PBA activities after the fact.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 pt-4">
              How Ovasyt handles this
            </h2>
            <p>
              Ovasyt's donations module issues Section 18A receipts with
              sequential numbering, a tamper-evident hash, and a public
              verification link so donors and auditors can confirm authenticity.
              Donations in kind can be captured with a description, valuation
              method, and attached evidence — the receipt PDF and the IT3(d)
              export both carry that detail through to SARS-ready records.
            </p>
            <p>
              <Link to="/signup/company" className="text-primary font-semibold hover:underline">
                Start issuing compliant 18A receipts →
              </Link>
            </p>

            <hr className="my-8 border-slate-200" />
            <p className="text-xs text-slate-500">
              This guide is informational and doesn't replace tax advice. Confirm
              specifics with your auditor or a registered tax practitioner
              before issuing 18A certificates for non-cash donations.
            </p>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}