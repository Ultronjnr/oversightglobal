## Goal

Deliver the full Ovasyt task list in four reviewable phases, so each phase can be tested before the next lands.

---

## Phase 1 — Quick wins (wording, settings, small UI)

- Replace all support/contact addresses with `connect@ovasyt.tech` (Contact page, Book Demo, footer, contact edge function + email template).
- NPO-first wording: "Your business" -> "Your NPO", "South African businesses" -> "South African NPOs", remove the "Personal" plan/section, mark SMME-only features "Coming Soon".
- Supplier wording: "Negotiation"/"Negotiations" -> "Counter Offer" in the supplier portal.
- Demo session timeout -> 15 minutes.
- "Book a demo" buttons on marketing pages link straight to the Google Calendar URL.
- Notifications: scrollable dropdown (full 50 items) + click opens a detail side panel with a "Go to transaction" action.
- Invoice upload: remove the redundant "upload image" control and the receipt auto-detection block; keep "Take a picture" and "Upload PDF" only.

## Phase 2 — Forms, permissions, attachments

- New Purchase Requisition form: add Project and Donor selectors sourced from the Donation Management panel (`donation_projects`, `organization_donors`), saved to `purchase_requisitions.project_id` / `donor_id`.
- Hide/disable the Expense Category field for employee-created entries; Finance sets it at categorisation time. AI scan may still suggest a category, shown read-only to employees.
- Employee portal attachments: attach receipts / proof of payment to their own open PRs and transactions using the existing `attachments` table + `AttachmentUploadModal`, with RLS scoped to the uploader's org and own records.
- Duplicate detection: on PR submit and on Finance approval, look for same-org PRs with matching supplier/amount/items in the last 30 days and show a "possible duplicate — verify" confirm dialog before proceeding.

## Phase 3 — Payments logic

- Batch payments: POP upload per batch on confirmation, stored in the batch-exports bucket, plus a generated unique per-transaction reference within each batch (e.g. `BATCH-0007-03`), persisted on `payment_allocations.payment_reference`.
- Reimbursements: require a POP on claim. On approval, mark the original transaction Paid (employee already paid) and push the reimbursement claim into Approved – Not Paid for batch payout back to the employee.
- SQI transactions: verify and fix the transition so marking Awaiting Payment lands the transaction in the Approved – Not Paid queue (adjust `get_approved_not_paid_queue`).
- Budget vs Spent: drop "Reserved" from the donations UI and reporting; track only Budget vs Spent. Reports show Date, Donor, Type, Expense Category.

## Phase 4 — Navigation and dashboard shell

- Desktop: move top tabs into a left vertical sidebar (shadcn sidebar, collapsible to icon rail) in `DashboardLayout`.
- Mobile: rework the hamburger into a scrollable grouped drawer so all items fit.
- Dashboard carousel: sliding analytics cards (VAT issues, expenditure, missing documentation, on-track spend) at the top of each portal dashboard.

---

## Technical notes

- Database work needed: attachment RLS for employees, `payment_allocations` reference column usage, reimbursement status transitions, and the Approved–Not-Paid queue RPC. Each ships as its own migration in the relevant phase.
- Gemini integration is already migrated to your own `GEMINI_API_KEY` (done last turn), so that item is complete.
- No visual redesign of the marketing site beyond the wording changes listed.

## Suggested order

Phase 1 first (fast, visible), then Phase 2, then 3, then 4. Tell me if you'd rather start with payments logic.
