# Approval → Payment Workflow Fix

## Problem

Today, when Finance approves a PR, nothing enters payment processing on its own. The "Approved But Not Paid" queue only contains supplier-uploaded **invoices**, which require:
- an accepted **quote**
- a **supplier account** (`invoices.supplier_id NOT NULL`)
- a supplier-uploaded invoice document

So PRs without a registered supplier (e.g. manually-typed supplier names) get stuck after Finance approval and never appear in the payment queue, batch processing, or expense history.

## Goal

Treat **Finance approval** as the moment a financial obligation is recognized. Auto-create a **Transaction** record at that point, regardless of supplier account or invoice upload, and feed it through the same Payment Preparation → Batch → Paid lifecycle.

## Approach

Introduce a lightweight `transactions` ledger that runs in parallel to (not instead of) `invoices`. Invoices keep working as today for supplier-driven flows; transactions cover Finance-approved PRs.

### 1. New table: `public.transactions`

Columns:
- `pr_id` (unique, FK → purchase_requisitions)
- `organization_id`
- `supplier_id` (nullable)
- `supplier_name` (text — captures manual supplier name)
- `amount`, `currency`
- `status`: `APPROVED_NOT_PAID` | `PARTIALLY_PAID` | `FULLY_PAID`
- `amount_paid` (running total)
- `approved_at`, `paid_at`
- standard timestamps + RLS (org-scoped, Finance/Admin)

### 2. Trigger on `purchase_requisitions`

`AFTER UPDATE` — when `status` transitions to `FINANCE_APPROVED`, upsert a `transactions` row with `APPROVED_NOT_PAID`, copying amount/currency/supplier hints from the PR.

### 3. Extend payment batches

- Add nullable `payment_allocations.transaction_id`.
- Update `create_payment_batch_draft`, `update_batch_draft`, `confirm_batch_paid`, `cancel_batch_draft` to accept and process `transaction_id` allocations the same way they handle invoice/reimbursement allocations:
  - On confirm → sum allocations, set `transactions.status` to `PARTIALLY_PAID` or `FULLY_PAID`, update `amount_paid` and `paid_at`.

### 4. UI wiring (no redesign)

- **PaymentPreparationTab** ("Approved But Not Paid"): add a third source — open transactions (`APPROVED_NOT_PAID` + `PARTIALLY_PAID`) — into the existing combined rows list. Reuse current row UI and BatchPaymentModal (new `kind: "transaction"`).
- **TransactionStatusTab**:
  - `PARTIALLY_PAID` and `FULLY_PAID` filters: include matching transactions alongside invoices.
  - New status surface in the same component using existing badges.
- **Expense History** (PRHistory): already lists FINANCE_APPROVED PRs; ensure the transaction status badge is reflected.

### 5. Workflow guarantees verified after build

- Finance approve PR → row appears in `transactions` (`APPROVED_NOT_PAID`).
- Add to batch → still `APPROVED_NOT_PAID` until batch is confirmed.
- Confirm batch with partial amount → `PARTIALLY_PAID`, `amount_paid` updated.
- Confirm batch with remaining amount → `FULLY_PAID`, `paid_at` set.
- Works for PRs with **no supplier account** (manual supplier name preserved).

## What stays untouched

- Existing PR statuses (`PENDING_HOD_APPROVAL` … `FINANCE_APPROVED`) unchanged.
- Supplier RFQ → quote → invoice flow unchanged.
- Reimbursements flow unchanged.
- All existing RLS, role permissions, and UI styling preserved.

## Risk / non-goals

- No redesign, no new tabs, no changes to approval UI.
- No changes to invoice or reimbursement schemas.
- Backfill of historical FINANCE_APPROVED PRs is included in the migration so existing approved-but-stuck PRs surface immediately.
