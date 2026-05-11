## Goal

Add a stable Payment Status Engine + Batch Payment Management to the Finance portal **without breaking** existing approval flows, supplier uploads, chats, notifications, or realtime. All work is additive.

## Current state (verified)

- `invoices.status` already supports `UPLOADED → AWAITING_PAYMENT → PARTIALLY_PAID → PAID`.
- `payment_allocations` already track partial amounts; `create_payment_batch` RPC validates that allocations cannot exceed the invoice total (defensive checks already exist).
- `TransactionStatusTab` already renders Partially Paid / Fully Paid / Overdue / Reimbursements / Batches tabs.
- `BatchPaymentModal` + `BatchesTab` exist but a batch immediately marks invoices `PAID` / `PARTIALLY_PAID` — there is **no Draft → Confirmed lifecycle**.
- No explicit "Approved But Not Paid" counter, no overdue auto-detection, no payment audit log.

## Schema changes (additive only)

New migration:

1. `payment_batches`: add `status text default 'DRAFT'` (`DRAFT | CONFIRMED | PAID | CANCELLED`), `batch_number text` (auto-generated `PB-YYYYMMDD-####`), `confirmed_at`, `paid_at`, `payment_reference text`.
2. `payment_allocations`: add `payment_date date`, `payment_reference text`, `created_by uuid`.
3. New table `payment_audit_log` (id, organization_id, invoice_id, batch_id nullable, action text, old_status text, new_status text, amount numeric, performed_by uuid, performed_at, notes text) + RLS: Finance/Admin select within org, inserted only by SECURITY DEFINER RPCs.
4. New RPCs (all `SECURITY DEFINER`, granted to `authenticated`):
   - `create_payment_batch_draft(_allocations jsonb, _notes)` — replaces immediate-paid behavior; creates batch in `DRAFT`, inserts allocations but **does not** update invoice status yet.
   - `update_batch_draft(_batch_id, _add jsonb, _remove uuid[])` — modify draft allocations.
   - `confirm_batch_paid(_batch_id, _payment_reference, _payment_date)` — flips batch → `PAID`, updates each invoice to `PAID` / `PARTIALLY_PAID` based on cumulative `amount_paid`, writes `payment_audit_log` rows, fires existing trigger notifications.
   - `cancel_batch_draft(_batch_id)` — deletes draft allocations, sets batch `CANCELLED`.
   - `recompute_overdue_invoices()` — marks invoices `OVERDUE` (new logical status, stored as `status='OVERDUE'`) when `AWAITING_PAYMENT` and `created_at + 30 days < now()`. Run on read (cheap) — called from Finance portal load.
5. Keep the existing `create_payment_batch` RPC available (deprecated path) so any legacy callers don't break.

## Frontend changes (additive, no refactors)

### `FinancePortal.tsx`
- Add a new "Approved Not Paid" KPI card in the existing summary grid (already wired for counters).
- Add tab `Approved Not Paid` BEFORE the existing Payments tab (do not remove anything). The tab lists invoices with `status='AWAITING_PAYMENT'` and < 30 days old.
- Wire overdue invoices to the existing Overdue tab (already in `TransactionStatusTab`).

### `PaymentPreparationTab` + `TransactionStatusTab` (Partially Paid sub-tab)
- Replace "Mark as Paid" with "Create Batch (Draft)" calling `create_payment_batch_draft`.
- Existing "Create Payment Batch" path remains for partial-payment flow but now creates DRAFT batches.

### `BatchesTab`
- Show new `status` column with badges Draft/Confirmed/Paid/Cancelled.
- Row expand for Draft batches: "Add/Remove transactions", "Confirm Paid" (prompts payment reference + date), "Cancel".
- Show payment reference + timestamps in expanded view.

### Realtime
- Keep all existing realtime hooks. Add a subscription on `payment_batches` in `useNotificationCounts` so batch counters refresh.

## Defensive validation (server-side, enforced in RPCs)
- Allocation amount > 0 and ≤ remaining balance (already enforced; preserved).
- Cannot confirm a batch that is not `DRAFT`.
- Cannot modify a `CONFIRMED` or `PAID` batch.
- Outstanding balance derived from sum of allocations of `PAID`/`CONFIRMED` batches only (drafts excluded) so drafts don't prematurely lock funds.

## Notifications
- Use existing `tg_batch_notifications` trigger; extend it to send distinct titles for `DRAFT` (created), and add an explicit `INSERT` into notifications inside `confirm_batch_paid` ("Batch confirmed paid"). Reuse the existing `notification_type` enum values (`batch_created`, `partial_payment`, `full_payment`) — no enum changes needed.

## Out of scope (per instructions)
- No routing changes.
- No changes to approval RLS, PR flow, chat, or supplier uploads.
- No Netcash / Yoco wiring — schema simply leaves `payment_reference` as a free text field for future API integration.

## Risk mitigation
- All schema changes are `ADD COLUMN ... DEFAULT ...` / new tables → existing data unaffected.
- Existing `create_payment_batch` RPC retained.
- Each new RPC enforces `has_role('FINANCE')` + organization scoping (identical to current security model).
- Audit log writes are inside the SECURITY DEFINER RPCs, so they cannot be bypassed by direct client writes.

After approval I will:
1. Run one migration with all schema + RPC changes.
2. Update `FinancePortal.tsx`, `BatchesTab.tsx`, `BatchPaymentModal.tsx`, `PaymentPreparationTab.tsx` and `TransactionStatusTab.tsx` minimally.
3. Verify build, then summarize.