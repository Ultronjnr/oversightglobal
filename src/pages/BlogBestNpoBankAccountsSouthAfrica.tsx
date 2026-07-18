import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";

export default function BlogBestNpoBankAccountsSouthAfrica() {
  const url =
    "https://ovasyt.tech/blog/best-npo-bank-accounts-south-africa";

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Best NPO Bank Accounts in South Africa (2026 Comparison)",
    description:
      "A practical comparison of NPO bank accounts in South Africa — FNB, Nedbank, Standard Bank, Absa and Capitec — covering fees, setup requirements, and compliance features for NGOs and PBOs.",
    author: { "@type": "Organization", name: "Ovasyt" },
    publisher: { "@type": "Organization", name: "Ovasyt" },
    datePublished: "2026-07-18",
    dateModified: "2026-07-18",
    mainEntityOfPage: url,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Can an NPO open a bank account in South Africa without being registered as a PBO?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. Banks require the NPO registration certificate from the Department of Social Development, the constitution, and FICA documents for signatories. PBO status with SARS is separate and is only required to issue Section 18A tax receipts.",
        },
      },
      {
        "@type": "Question",
        name: "Which bank has the cheapest NPO account in South Africa?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Nedbank's Non-Profit Bundle and FNB's Non-Profit Account are typically the most affordable, offering reduced monthly fees and free electronic transactions for registered NPOs and PBOs. Capitec Business Account is often the cheapest overall for small NPOs but is not NPO-branded.",
        },
      },
      {
        "@type": "Question",
        name: "What documents do I need to open an NPO bank account?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "NPO registration certificate (NPO number), founding document / constitution, signed resolution appointing signatories, FICA (ID and proof of address) for each signatory, and proof of the NPO's physical address.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Best NPO Bank Accounts in South Africa (2026 Comparison) | Ovasyt"
        description="Compare NPO bank accounts in South Africa — FNB, Nedbank, Standard Bank, Absa and Capitec. Fees, setup, FICA requirements and compliance features for NGOs and PBOs."
        path="/blog/best-npo-bank-accounts-south-africa"
        type="article"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
      <SiteNav />
      <main>
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            ● NPO finance guide
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-6">
            Best NPO bank accounts in South Africa (2026 comparison)
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-8">
            Choosing the right bank account is one of the first practical
            decisions a new NGO, NPO or PBO makes in South Africa. The wrong
            choice means high monthly fees, limits on donor transfers, or
            paperwork the bank won't accept when your auditor calls. This
            guide compares the main NPO-friendly accounts on fees, setup
            requirements and the compliance features that actually matter for
            audit and Section 18A reporting.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-3">
            What to look for in an NPO bank account
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-6">
            <li>Reduced or waived monthly fees for registered NPOs / PBOs.</li>
            <li>Free or low-cost EFTs — donations arrive by transfer, not card.</li>
            <li>Multi-user online banking with role separation (release vs capture).</li>
            <li>Reference fields long enough to carry a Section 18A receipt number.</li>
            <li>Bulk-payment (ACB / Netcash-friendly) support for supplier runs.</li>
            <li>Statements that export cleanly to CSV for your accounting system.</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-3">
            Comparison at a glance
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border/60 mb-6">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-slate-900">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Bank</th>
                  <th className="text-left px-4 py-3 font-semibold">Account</th>
                  <th className="text-left px-4 py-3 font-semibold">Typical monthly fee</th>
                  <th className="text-left px-4 py-3 font-semibold">Best for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Nedbank</td>
                  <td className="px-4 py-3">Non-Profit Bundle</td>
                  <td className="px-4 py-3">Reduced / bundled</td>
                  <td className="px-4 py-3">Established PBOs with regular donor activity</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">FNB</td>
                  <td className="px-4 py-3">Non-Profit Account</td>
                  <td className="px-4 py-3">Discounted for NPOs</td>
                  <td className="px-4 py-3">Digital-first teams using online banking</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Standard Bank</td>
                  <td className="px-4 py-3">MyMo Business / NPO tier</td>
                  <td className="px-4 py-3">Pay-as-you-transact</td>
                  <td className="px-4 py-3">Low-volume NPOs that want simple pricing</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Absa</td>
                  <td className="px-4 py-3">NPO Cheque Account</td>
                  <td className="px-4 py-3">Reduced bundle</td>
                  <td className="px-4 py-3">NGOs with branch-based donors and cash deposits</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Capitec</td>
                  <td className="px-4 py-3">Business Account</td>
                  <td className="px-4 py-3">Flat monthly + per-transaction</td>
                  <td className="px-4 py-3">Small / early-stage NPOs watching cost</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mb-8">
            Fees change often — always confirm current pricing with the bank
            before signing. This table is a directional comparison, not a
            quote.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-3">
            Documents every bank will ask for
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-6">
            <li>NPO registration certificate (NPO number from the DSD).</li>
            <li>Founding document / constitution or trust deed.</li>
            <li>Board resolution appointing signatories and account operators.</li>
            <li>FICA — ID and proof of address — for every signatory.</li>
            <li>Proof of the NPO's physical operating address.</li>
            <li>Where applicable, your SARS PBO letter and Section 18A approval.</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-3">
            How this ties into Section 18A and audit
          </h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            Your bank account is the paper trail SARS and your auditor start
            from. Every donation you issue a Section 18A receipt for must be
            traceable back to a receipt line on your statement, and every
            supplier payment must match an approved purchase requisition.
            Ovasyt ties donations, receipts and payments to those bank lines
            automatically, so you spend less time reconciling and more time
            running the programme.
          </p>

          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 mt-10">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Automate donor receipts and supplier payments
            </h3>
            <p className="text-slate-700 mb-4">
              Ovasyt is built for South African NGOs — Section 18A receipts,
              procurement approvals and payment batching in one audit-ready
              platform.
            </p>
            <Link
              to="/signup/company"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start free
            </Link>
          </div>

          <p className="text-sm text-muted-foreground mt-10">
            Related:{" "}
            <Link className="text-primary hover:underline" to="/blog/how-to-register-pbo-section-18a">
              How to register a PBO and get Section 18A approval
            </Link>
            {" · "}
            <Link className="text-primary hover:underline" to="/blog/section-18a-donations-in-kind">
              Section 18A receipts for donations in kind
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}