# Save the card after Yoco hosted checkout

## Confirmed problem
After an admin pays through the Yoco hosted checkout, no card is stored:

- `yoco-create-checkout`, `yoco-verify-checkout` and `yoco-webhook` only touch invoices and the subscription row — none of them writes to `payment_methods`.
- Only `yoco-save-card` inserts card rows, and it is no longer called from any screen.
- So the Payment Method tab always shows "No card on file", and next cycle `yoco-charge-subscription` hits the "no card" branch, marks the invoice FAILED and flips the subscription to PAST_DUE.

## What to build

1. **Request card saving at checkout**
   In `yoco-create-checkout`, ask Yoco to tokenise the card for reuse (`saveCard` / vault flag on the checkout payload, per the Yoco checkout API) and keep the existing metadata (`organizationId`, `invoiceId`, `planId`, `cycle`).

2. **Persist the token on success — one shared helper**
   Add a helper in `supabase/functions/_shared/payments.ts`, e.g. `upsertPaymentMethodFromCheckout(admin, orgId, checkout)`, that:
   - reads the returned payment/card details (token/`paymentMethodId`, brand, last 4, expiry) from the checkout lookup response,
   - skips silently if Yoco returned no reusable token,
   - clears `is_default` on existing rows for the org, then inserts the new default card row.
   Call it from both `yoco-verify-checkout` (after the status is `completed`) and `yoco-webhook` (on `payment.succeeded`), so it works whether or not the webhook fires. Both paths are idempotent by token.

3. **Grace instead of instant PAST_DUE**
   In `yoco-charge-subscription`, when no card is on file, keep the failed attempt record but do not set PAST_DUE on the first attempt — allow the existing retry backoff to run, and only flip to PAST_DUE once attempts are exhausted. This prevents a paying customer being cut off by a single missing-token case.

4. **Payment Method tab wording**
   In `PaymentMethodTab.tsx`, when there is no card but the subscription is ACTIVE, show "Card will be stored on your next checkout" rather than implying billing is broken, keeping the "Add card via checkout" action.

## Verification
- Run a test-mode checkout end to end and confirm a `payment_methods` row appears with brand/last4 and `is_default = true`.
- Re-open the Payment Method tab and confirm the stored card renders.
- Invoke `yoco-charge-subscription` for that org and confirm it charges the stored token instead of failing.

## Note
Step 1 and 2 depend on the exact field names Yoco returns for saved cards on hosted checkout; the implementation will read them from a live test-mode checkout response before wiring the insert, and log the payload shape if the fields are absent.
