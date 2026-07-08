# Section 18A Donation Management + Donor Fund Tracking Module

A `/donations` module (Admin + Finance) for a reusable **organization-wide donor registry**, **donor funding pools**, Section 18A receipting, and the foundations for donor→funding→project→expense→transaction→reporting traceability discussed in the meeting.

## User-facing surface

New page `DonationsPage` (`/donations`) using `DashboardLayout`, opening on a **Dashboard**, then tabs:

1. **Dashboard** — metric cards: Total Donors, Total Donations, Receipts Issued, Pending Receipts, Available Funding, Allocated Funding. Global search box (donor / receipt / donation).
2. **Donor Registry** — reusable donor CRUD (individuals & organizations), searchable.
3. **Donations** — donation records linked to a donor + funding pool; searchable.
4. **Funding Pools** — per-donor pool view: Total Donated, Allocated, Spent, Remaining/Available.
5. **Projects** — lightweight project registry to allocate funding against (foundation for procurement link).
6. **Receipts** — generate → preview → issue → download → email; searchable.
7. **Template & Branding** — editable receipt template (colors, header/declaration text, signatory) + logo/signature/stamp uploads on the Org Profile sub-panel.

Nav link "Donations / 18A" added to Admin and Finance portals.

## Data model (new tables, org-scoped, RLS + GRANTs + updated_at triggers)

- **organization_donors** (Master Donor Registry, reusable platform-wide): `organization_id`, `donor_type`, `name`, `id_or_reg_number`, `income_tax_number`, `email`, `phone`, `address`, `notes`, `is_active`.
- **donor_funding_pools** (one per donor, auto-created): `organization_id`, `donor_id`, `total_donated`, `total_allocated`, `total_spent`, computed `remaining`/`available`. Balances maintained by triggers on donations/allocations so they never drift.
- **donation_projects** (project registry for allocation): `organization_id`, `name`, `code`, `description`, `status`, `budget`.
- **donations**: `organization_id`, `donor_id`, `donation_date`, `amount`, `currency`, `donation_type` (`CASH`/`IN_KIND`), `description`, `in_kind_value`, `receipt_id` (nullable). Insert/update adjusts the donor's pool `total_donated`.
- **fund_allocations** (foundation for procurement link): `organization_id`, `donor_id`, `pool_id`, `project_id`, `amount`, `allocation_type` (`RESERVED`/`SPENT`), `source_type` (`MANUAL`/`EXPENSE`/`TRANSACTION`), `source_id` (nullable, for future procurement `transactions`/`expenses`), `description`. Adjusts pool `total_allocated`/`total_spent`.
- **donation_org_profiles** (one per org): `organization_id`, `legal_name`, `npo_number`, `pbo_number`, `vat_number`, `registration_number`, `physical_address`, `postal_address`, `contact_name`, `contact_email`, `contact_phone`, `signatory_name`, `signatory_designation`, `logo_path`, `signature_path`, `stamp_path`, `receipt_prefix` (default `18A`), `next_receipt_number`, `template` (JSONB).
- **donation_receipts** (versioned, never overwritten): `id` (UUID), `organization_id`, `receipt_number`, `donation_id`, `donor_id`, `issued_at`, `status` (`DRAFT`/`ISSUED`/`EMAILED`/`CANCELLED`), `snapshot` (JSONB), `pdf_path`, `version`, `verification_hash`, `created_by`, `updated_by`, `created_at`, `updated_at`. Edits create a **new version row** rather than mutating the issued one.
- **donation_audit_log**: `organization_id`, `entity_type` (donor/donation/receipt/allocation), `entity_id`, `action` (`CREATED`/`EDITED`/`ISSUED`/`DOWNLOADED`/`EMAILED`/`CANCELLED`), `actor_id`, `details` (JSONB), `created_at`.

**Receipt numbering:** `SECURITY DEFINER` function `next_donation_receipt_number(org_id)` atomically increments and returns e.g. `18A-2026-0001`.

**Verification:** each receipt gets a UUID + `verification_hash` (deterministic hash of receipt number + donor + amount + issue date). A public verification URL pattern `/verify/receipt/:id` is reserved (lightweight read-only page that confirms a receipt's core details from the hash — built as part of this module).

## Storage

New **private** bucket `donation-assets` for logo/signature/stamp + generated receipt PDFs, namespaced by `organization_id`. RLS on `storage.objects` restricts to the owning org. Branding images embedded as base64 in the PDF; PDFs delivered via short-lived signed URLs.

## Services

- `donation.service.ts` — CRUD for donors, pools, projects, donations, allocations, org profile; asset upload; audit-log writes; dashboard aggregates; search.
- `donation-receipt.service.ts` — jsPDF + jspdf-autotable **professional A4 receipt**: official branding/logo, NPO/PBO/VAT + addresses/contacts, receipt + verification number, donor & donation details (amount in words + figures), editable SARS Section 18A declaration, **QR code** encoding the verification URL, subtle **watermark**, digital **signature** + org **stamp** images, dynamic footer. Returns a `Blob` reused for preview / download / email. QR via a small `qrcode` dependency.

## Email

Reuse existing app-email infra. Attachments unsupported → email contains a secure short-lived signed download link. New `donation-receipt` template scaffolded + wired to `send-transactional-email`. Delivery requires the org's email domain to be configured.

## Extensibility (per meeting)

`fund_allocations.source_type`/`source_id` are the seam for later procurement integration:
`Donor → Funding Pool → Allocation → (future) Expense/Project → Transaction → Reporting → Section 18A`.
No procurement tables are modified now; the columns and project registry make the future link additive.

## Technical notes

- Pool balances maintained by DB triggers (single source of truth) — the app reads, never recomputes ad hoc.
- Amounts use org currency via existing `useCurrency`/`formatCurrency`.
- Org Profile auto-populated from the existing `organizations` row on first load.
- Preview-before-save: PDF rendered from in-memory data before any DB write.
- Receipts immutable once issued; corrections = new version; audit log records every action.
- RLS scoped to caller's organization using the existing membership pattern; `donation_audit_log` insert-only from app, read within org.

## Build order

1. Migration: tables, GRANTs, RLS, numbering + balance/audit triggers, verification hash function.
2. Storage bucket + policies.
3. Services (data + PDF + QR).
4. UI: page, dashboard, tabs, forms, search, receipt preview dialog.
5. Public receipt verification page + route.
6. Routing + portal nav links.
7. Email template + wiring.
8. Verify: typecheck + Playwright smoke test of receipt preview.
