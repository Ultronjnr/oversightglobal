
# Phased delivery plan

Ship in 5 phases. You test after each phase before I move to the next. This prevents regressions before your paygate launch.

Decisions locked in from your answers:
- Project + Donor are **required** on every PR and scanned invoice.
- Project budget is a **hard block** — approval fails if allocation exceeds remaining funds.
- Negotiation button is labelled **"Counter-offer"** on both supplier and finance sides.
- **Phased** rollout.

---

## Phase 1 — Foundation: data model + duplicate prevention + critical bug fix
Covers items **5, 6 (data half), 8, 9, 11 (data half)**.

**Migration:**
- Add `project_id uuid` (FK → `donation_projects`) and `donor_id uuid` (FK → `donation_org_profiles`) to `purchase_requisitions`, `transactions`, `invoices`, and `ocr_analyses`. NOT NULL enforced at the app layer for new records; existing rows nullable.
- Add `scan_document_path text` + `scan_document_bucket text` on `transactions` and `invoices` so the scanned file is persisted and previewable.
- Add UNIQUE constraint `transactions_pr_id_key` on `transactions(pr_id)` → **one transaction per PR**, DB-enforced.
- Add UNIQUE partial index on `invoices(quote_id) WHERE quote_id IS NOT NULL` → **one invoice per accepted quote**.
- Add `pr_locked boolean default false` on `purchase_requisitions`; trigger flips it to true when a transaction is created OR an invoice is scanned against it → PR disappears from "Incoming PRs" queries.
- Fix `invoices_status_check`: audit the current CHECK values against every code path that writes to `invoices.status`, extend the CHECK to cover missing values (`PARTIALLY_PAID`, `FULLY_PAID`, `AWAITING_PAYMENT`).
- New RPC `public.allocate_project_funds(project_id, donor_id, amount)` — SECURITY DEFINER, atomic: locks the project row, checks `spent + reserved + amount <= budget`, raises if exceeded, else records the allocation. Called by PR approval and scan-invoice create-transaction.
- RLS + GRANTs updated to match.

**Code:**
- `getIncomingPRs` / `FinanceApprovalQueue` query filters out `pr_locked = true` and anything with an existing `transactions` row.
- Batch payment path stops writing an invalid `invoices.status` value.

**Deliverable:** you can approve, quote, invoice, batch, and mark paid without duplicates or the `invoices_status_check` error. No UI changes yet beyond the incoming-PR filter.

---

## Phase 2 — Scan Invoice pipeline
Covers items **2, 6 (UI half), 7, 10, 12**.

- `ScanInvoiceModal`: persist the uploaded PDF/image path to `transactions.scan_document_path` (already uploads to `invoice-documents`, currently discards path).
- Add **Category → Project → Donor** required pickers after OCR completes. Project list filtered by selected donor. Shows remaining budget live.
- On "Create Transaction from Invoice": call `allocate_project_funds` RPC; on success route the record straight into **Approved – Not Paid**.
- `TransactionStatusTab` row expander: show Project, Donor, Category, and an inline **Preview Document** button that fetches a short-lived signed URL via existing `get-document-url` edge function.
- OCR speed: switch `analyze-document` to Lovable AI `google/gemini-2.5-flash` (fastest vision model), parallelize upload + kick off analysis (don't await upload completion before starting the signed-URL step where safe), and stream progress toasts.

---

## Phase 3 — Quotes, Approvals, Counter-offer UX
Covers items **1, 3, 11, 13**.

- **Supplier quote form** (`SubmitQuoteModal`): replace text input for Delivery with shadcn date picker. Render one price input per PR line item; total auto-sums and is read-only.
- **Finance Quote Comparison** (`QuoteComparisonView`): expand each quote card to list items + supplier per-item prices. Add **"Counter-offer"** button that opens a modal — Finance edits per-item prices, adds a note, submits. This creates a new `quote_requests` row with `parent_quote_id` and sets original quote to `COUNTERED`; supplier sees it in their portal and can submit revised quote.
- **Approve PR modal** (`FinanceApprovalQueue`): add required Project + Donor pickers next to Supplier picker. Blocks approval via `allocate_project_funds` if over budget, with clear inline error.
- **Redesign Approvals tab → "Workflow & Audit Trail" view**: for each PR, a vertical timeline (PR Created → HOD Approved → Finance Approved + Supplier assigned → Quote Received → Quote Accepted/Countered → Invoice Received → Batch Created → Paid) with actor name + timestamp on each node. Uses existing `pr-history.service` + `transaction_events` — no new tables.

---

## Phase 4 — Navigation polish
Covers item **4**.

- Move **Cost Center / Department History** from the action-bar button to a top-level tab next to **Expense History** in `FinancePortal` (and HOD/Admin portals where present).

---

## Phase 5 — Full audit + paygate readiness
Covers item **14**.

- Dead-code sweep: grep for unused components, unused RPCs, orphaned edge functions.
- Full RLS re-scan.
- Duplicate-prevention smoke test: create-approve-quote-invoice-batch-pay on a fresh PR, then attempt every duplicate path (re-approve, re-invoice same quote, re-batch same invoice) and confirm each is blocked.
- Paygate readiness checklist (Yoco subscription flow + Netcash supplier batches already exist — confirm both against live keys before enabling billing charges).

**Advice on what you may be missing (item 14 answer):**
1. **Idempotency keys on the batch-payment webhook** — Netcash can replay; without a UNIQUE `provider_event_id` you'll double-mark invoices as paid. I'll add this in Phase 5.
2. **Concurrency lock on batch creation** — two Finance users clicking "Create Batch" at the same time can add the same invoice to two batches. Needs an `advisory_lock` or a UNIQUE index on `(invoice_id, batch_status IN ('DRAFT','CONFIRMED'))`.
3. **Reversal path** — if a batch fails at Netcash, invoices need to move back to Approved – Not Paid. Currently they can get stuck in `PAYMENT_BATCH`.
4. **PR edit-after-approval** — should be locked (I'll add via `pr_locked` in Phase 1).
5. **Donor budget over-allocation across reservations** — hard block covers new allocations, but existing reservations should be validated on project edit too.

---

## Ordering & your ETA

Phase 1 first (biggest impact, unblocks the current `invoices_status_check` error and the duplicate problem). I'll implement Phase 1 as one migration + one code pass, you smoke-test, then I move to Phase 2.

Reply **"go phase 1"** to start.
