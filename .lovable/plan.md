# Pricing content refresh + Ovasyt rebrand

Scope is content, copy, and metadata only. No layout, styling, animation, routing, or component structure changes. No unrelated refactors.

## 1. `src/pages/Pricing.tsx` — content-only edits

Keep the current section order, card layout, "Most popular" badge on middle card, comparison table structure, FAQ accordion styling, and all Tailwind classes. Only swap data arrays and strings.

**Hero**

- Eyebrow: `PRICING`
- H1: `Plans that keep you funder-ready, all year round`
- Sub: `Every plan includes the full approval chain, invoice scanning, donor fund tracking, and a complete audit trail. No setup fees, no lock-in contracts.`

**PLANS array** — replace all three:

- **Platform** — `R1 999` `/month` — CTA `Start free trial` → `/signup/company`. Description + feature list per spec (5 users incl. roles, full approval chain, 150 scans/mo, SARS validation, project & donor fund tracking, 30 donor profiles, donor + project reports, supplier portal, invite up to 50 suppliers, in-platform quotes, 50 s18A receipts/yr, 10 GB storage, standard audit trail).
- **Funder-Ready** (popular=true) — `R5 998` `/month` — CTA `Book a demo` → `/signup/company`. Everything in Platform + 10 users, unlimited donor profiles, 150 supplier accounts, 300 scans/mo, 25 GB storage, unlimited s18A receipts, monthly bookkeeping, independently reviewed AFS, income tax submissions, priority support, guided onboarding, staff training.
- **Tailored** — `Custom` — CTA `Talk to sales` → `/signup/company`. Unlimited users, multi-entity, custom approval logic, reviewed or audited AFS, priority processing, dedicated account manager, supplier accounts as agreed, custom storage, custom integrations.

**COMPARE array** — replace with the 18 rows in the spec (Users Included, Supplier Accounts, Invoice Scans, Donor Profiles, Storage, Approval Chain, Project & Donor Fund Tracking, Donor Reports, Project Reports, Supplier Portal, SARS Invoice Validation, Section 18A Receipts, Monthly Bookkeeping, Independently Reviewed AFS, Income Tax Submissions, Support, Onboarding, Entities). Column headers become `Platform / Funder-Ready / Tailored`. Add footnote below the table: `*Available to SARS-approved Section 18A organisations.`

**NEW Add-ons section** — insert between comparison table and FAQ. Reuse the existing pricing-card visual pattern (same rounded card / border / padding classes already used on the page) so styling matches. Two cards:

- `Additional Users` — `R39/user/month` — copy per spec.
- `Unlimited Section 18A Receipts` — `R49/month` — copy per spec (note: included in Funder-Ready).

**FAQ array** — replace all 8 items with the questions & answers from the brief (free trial, plan changes, Platform vs Funder-Ready, what counts as a scan, single Finance Manager/Admin rationale, supplier accounts, mid-year join catch-up, VAT/billing terms).

## 2. `index.html` — metadata rebrand

- `<title>`: `Ovasyt | Procurement & Compliance for NGOs and NPOs`
- `meta description`: `Ovasyt gives South African NGOs and NPOs procurement approvals, donor fund tracking, supplier management, invoice scanning and audit-ready compliance.`
- `meta author`: `Ovasyt`
- `og:title` / `twitter:title`: `Ovasyt | Procurement & Compliance for NGOs and NPOs`
- `og:description` / `twitter:description`: same as meta description
- `og:url`: `https://ovasyt.tech/`
- Add `og:site_name` = `Ovasyt`

Per head-metadata rules, do not add an `og:image` (hosting injects one). Per-route Pricing metadata is out of scope unless the user wants react-helmet-async introduced — noted below as an optional follow-up, not part of this plan.

## 3. Incidental copy rebrand

- `src/components/billing/PlansTab.tsx` line 41: change `sales@oversight.global` → `sales@ovasyt.tech`.
- `src/pages/OAuthConsent.tsx`: `access Oversight` → `access Ovasyt`.
- `src/index.css` comment: `Oversight Design System` → `Ovasyt Design System`.
- Leave `src/lib/mcp/index.ts` and `supabase/functions/mcp/index.ts` MCP `name`/`title` strings alone (internal identifiers; renaming could break MCP client bindings).
- Leave auth email hook and supplier-invitation email template untouched unless the user confirms — those are transactional email brand strings that need a coordinated content review.

## 4. `public/robots.txt`

Already permits all crawlers; no change needed. Not adding a `Sitemap:` directive (no sitemap file exists and one wasn't requested).

## Out of scope (call out to user)

- No sitemap.xml exists; creating one isn't part of this request.
- Per-route (`<Helmet>`) metadata for `/pricing` requires adding `react-helmet-async`. Static `index.html` metadata is what social crawlers see, so the rebrand there fixes the WhatsApp/LinkedIn preview problem. Ask separately if you want per-page titles.
- Transactional email templates (`auth-email-hook`, `supplier-invitation`) still reference OVERSIGHT — flag but don't touch without approval.

## Validation

- `rg -i "oversight|leadtech|oversight\.global"` returns only the intentionally-left MCP identifiers and the flagged email templates.
- Pricing page renders with new copy, badge still on middle card, comparison table shows 18 rows, Add-ons section sits between table and FAQ, 8 FAQ items.
- No changes to Tailwind classes, no new dependencies, no routing changes.                               Implement the following as a CONTENT-ONLY update.
  CRITICAL RULES
  - DO NOT redesign the page.
  - DO NOT change any Tailwind classes.
  - DO NOT change spacing.
  - DO NOT change colors.
  - DO NOT change typography.
  - DO NOT change animations.
  - DO NOT change responsive behaviour.
  - DO NOT rename components.
  - DO NOT move files.
  - DO NOT introduce new libraries.
  - DO NOT refactor existing code.
  - DO NOT change routing except CTA destinations explicitly listed below.
  - DO NOT modify any page except those listed.
  - Preserve all existing styling and component structure.
  Only update content, data arrays, copy, metadata and the single new Add-ons section.
  ========================================
  1. src/pages/Pricing.tsx
  ========================================
  Keep the current section order exactly:
  Hero
  Pricing Cards
  Comparison Table
  NEW Add-ons
  FAQ
  Keep the existing component hierarchy and styling.
  ----------------------------------------
  Hero
  ----------------------------------------
  Eyebrow
  PRICING
  Heading
  Plans that keep you funder-ready, all year round
  Subheading
  Every plan includes the full approval chain, invoice scanning, donor fund tracking, and a complete audit trail. No setup fees, no lock-in contracts.
  ----------------------------------------
  PLANS ARRAY
  ----------------------------------------
  Replace the existing array only.
  Platform
  Price:
  R1 999
  Period:
  /month
  CTA:
  Start free trial
  CTA Route:
  /signup/company
  Description
  For NPOs that run their own books — or whose accountant works straight off their Ovasyt data.
  Features
  • 5 users (Admin, Finance Manager, HOD, Team Member)
  • Full approval chain
  Request → Approve → Invoice → Paid
  • Invoice scanning (150/month)
  • SARS tax invoice validation
  • Project & donor fund tracking
  • 30 donor profiles
  • Donor Reports
  • Project Reports
  • Supplier portal
  • Invite up to 50 suppliers
  • Request & receive quotes inside Ovasyt
  • Section 18A receipt generation (50/year)
  • 10 GB storage
  • Standard audit trail
  ----------------------------------------
  Funder-Ready
  popular = true
  Price
  R5 998
  Period
  /month
  CTA
  Book a demo
  Route
  /signup/company
  Description
  Everything in Platform — plus we carry your compliance. Never think about SARS or year-end again.
  Features
  Everything in Platform
  10 users
  Unlimited donor profiles
  150 supplier accounts
  300 invoice scans/month
  25 GB storage
  Unlimited Section 18A receipts
  Monthly bookkeeping
  Independently reviewed Annual Financial Statements
  Income tax submissions
  Priority support
  Guided onboarding
  Staff training
  ----------------------------------------
  Tailored
  Price
  Custom
  CTA
  Talk to sales
  Route
  /signup/company
  Description
  For NPO networks, federations and multi-entity organisations with complex funder requirements.
  Features
  Unlimited users
  Multi-entity support
  Custom approval logic
  Reviewed or audited AFS
  Priority processing
  Dedicated account manager
  Supplier accounts as agreed
  Custom storage
  Custom integrations
  ----------------------------------------
  Comparison Table
  ----------------------------------------
  Replace only the comparison data.
  Headers
  Platform
  Funder-Ready
  Tailored
  Include exactly these 18 rows
  Users Included
  Supplier Accounts
  Invoice Scans
  Donor Profiles
  Storage
  Approval Chain
  Project & Donor Fund Tracking
  Donor Reports
  Project Reports
  Supplier Portal
  SARS Invoice Validation
  Section 18A Receipts
  Monthly Bookkeeping
  Independently Reviewed AFS
  Income Tax Submissions
  Support
  Onboarding
  Entities
  Below the table add
  *Available to SARS-approved Section 18A organisations.
  ----------------------------------------
  NEW SECTION
  ----------------------------------------
  Insert ONE new section.
  Place it immediately after the comparison table.
  Place it immediately before FAQ.
  Reuse the existing pricing card styling already used on the page.
  Do not invent new styling.
  Heading
  Add-ons
  Subtitle
  Extend your Platform plan as your organisation grows.
  Card 1
  Additional Users
  R39/user/month
  Add additional HOD and Team Member users.
  Each organisation includes one Admin and one Finance Manager by design to maintain segregation of duties and a single point of accountability.
  Card 2
  Unlimited Section 18A Receipts
  R49/month
  Platform includes 50 receipts annually.
  Upgrade to unlimited generation at any time.
  Already included in Funder-Ready.
  ----------------------------------------
  FAQ
  ----------------------------------------
  Replace the FAQ array only.
  Include exactly 8 questions from the specification:
  1. Free trial
  2. Change plans
  3. Platform vs Funder-Ready
  4. What counts as a scan
  5. Why only one Finance Manager and Admin
  6. Supplier accounts
  7. Mid-financial-year onboarding
  8. VAT and billing
  Keep the existing accordion component.
  ========================================
  2. index.html
  ========================================
  Update only metadata.
  Title
  Ovasyt | Procurement & Compliance for NGOs and NPOs
  Meta Description
  Ovasyt gives South African NGOs and NPOs procurement approvals, donor fund tracking, supplier management, invoice scanning and audit-ready compliance.
  Author
  Ovasyt
  Open Graph
  og:title
  Ovasyt | Procurement & Compliance for NGOs and NPOs
  og:description
  same as meta description
  og:url
  [https://ovasyt.tech/](https://ovasyt.tech/)
  og:site_name
  Ovasyt
  Twitter
  twitter:title
  Ovasyt | Procurement & Compliance for NGOs and NPOs
  twitter:description
  same as meta description
  DO NOT add og:image.
  ========================================
  3. Copy Rebrand
  ========================================
  Update only these strings
  src/components/billing/PlansTab.tsx
  [sales@oversight.global](mailto:sales@oversight.global)
  ↓
  [sales@ovasyt.tech](mailto:sales@ovasyt.tech)
  src/pages/OAuthConsent.tsx
  access Oversight
  ↓
  access Ovasyt
  src/index.css
  Oversight Design System
  ↓
  Ovasyt Design System
  ========================================
  DO NOT TOUCH
  ========================================
  Leave unchanged
  src/lib/mcp/index.ts
  supabase/functions/mcp/index.ts
  Do not rename MCP identifiers.
  Do not edit transactional email templates.
  Do not add Helmet.
  Do not add react-helmet-async.
  Do not create sitemap.xml.
  Do not modify robots.txt.
  ========================================
  VALIDATION
  ========================================
  Before completing, verify
  ✓ Pricing page layout unchanged
  ✓ Same styling
  ✓ Same animations
  ✓ Same responsiveness
  ✓ Middle plan still marked Most Popular
  ✓ New Add-ons section between table and FAQ
  ✓ Comparison table contains exactly 18 rows
  ✓ FAQ contains exactly 8 items
  ✓ Metadata updated to Ovasyt
  ✓ No routing changes except specified CTA destinations
  ✓ No new dependencies
  ✓ No unrelated file modifications