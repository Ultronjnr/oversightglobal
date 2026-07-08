# Payment Providers: Yoco (subscriptions) + Netcash (supplier payments)

Two independent integrations. Both are custom bring-your-own-key providers (not Lovable built-ins), so each runs through Supabase edge functions with your own merchant credentials. Since no accounts exist yet, the full structure is built now and goes live once credentials are added.

## Part A — Yoco Subscription Billing

### Plans (seeded, ZAR/month)
- Starter — R799 (visible)
- Professional — R1,999 (visible, "Most Popular")
- Business — R4,999 (backend, hidden until enabled)
- Enterprise — Custom, "Contact Sales" (no online checkout)
- Annual option per plan = 10× monthly (2 months free)

### Model
Yoco has no native subscriptions. Flow: customer enters card via Yoco's secure popup → we store the returned card **token** (vault) + last4/brand → a monthly scheduled job charges each active subscription → failures trigger retry logic → all events verified via webhook.

### Billing UI (`/billing`, Admin only)
- Plan cards with feature lists, monthly/annual toggle, current-plan badge
- Add/replace card (Yoco popup), show vaulted card (brand + last4), remove card
- Subscription status (active / past_due / cancelled), next billing date
- Billing history table with downloadable PDF invoices
- Upgrade / downgrade / cancel

## Part B — Netcash Supplier Payments

Automates the existing batch flow. CSV export stays; a **"Pay via Netcash"** action is added to confirmed batches.

### Flow
Confirmed batch → submit creditor batch to Netcash → store provider reference → poll status → track settlement (pending → processing → settled/failed) per allocation → retry failed items → webhook updates → every step written to audit log.

### Finance UI additions
- "Pay via Netcash" button on confirmed batches (alongside existing export)
- Per-batch settlement status column + per-allocation status
- Retry action for failed payments
- Payment history view (all provider payments, filterable) + audit trail drawer

## Technical Section

### Database migration
New tables (all org-scoped, RLS restricted by organization, GRANTs for authenticated + service_role):
- `subscription_plans` — code, name, price_monthly, price_annual, features (jsonb), is_public, tier
- `organization_subscriptions` — plan_id, status, billing_cycle, current_period_start/end, cancel_at
- `subscription_invoices` — amount, status, period, pdf_path, yoco_charge_id
- `payment_methods` (card vault) — yoco_token, brand, last4, expiry, is_default
- `subscription_payment_attempts` — invoice_id, attempt_no, status, error, next_retry_at
- `netcash_payments` — batch_id, allocation_id, netcash_reference, status, settled_at, retries
- `payment_provider_events` (webhooks) — provider, event_type, external_id (unique for idempotency), verified, payload, processed_at

Extend `payment_batches` with `provider`, `provider_status`, `submitted_at`. Reuse existing `payment_audit_log`.

Enable `pg_cron` + `pg_net` for scheduling (via insert tool, since URLs/keys are project-specific).

### Edge functions
Yoco:
- `yoco-save-card` — exchange popup token, store vaulted card
- `yoco-charge-subscription` — charge one subscription (idempotent)
- `yoco-webhook` — verify signature (`webhook secret`), update invoice/subscription
- `billing-cron` — scheduled monthly: create invoices, charge due subs, schedule retries (exponential backoff, max 3)

Netcash:
- `netcash-submit-batch` — build + submit creditor batch, store reference
- `netcash-poll-status` — scheduled: fetch batch/settlement status, update allocations
- `netcash-webhook` — verify + process status callbacks
- `netcash-retry` — resubmit failed allocations

All webhooks: signature verification, idempotency via `payment_provider_events.external_id`, structured error surfacing.

### Secrets (requested when you're ready to go live)
- Yoco: `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`
- Netcash: `NETCASH_SERVICE_KEY`, `NETCASH_ACCOUNT_KEY`, `NETCASH_SOFTWARE_VENDOR_KEY`

Public Yoco key for the frontend popup lives in code/config (publishable).

### Build order
1. Migration (tables, RLS, GRANTs, seed plans, extend batches)
2. Services (`subscription.service.ts`, `netcash.service.ts`)
3. Edge functions + webhook handlers
4. Scheduling (pg_cron jobs)
5. Billing UI + pricing
6. Finance Netcash UI (button, status, retry, history, audit)
7. Verification (typecheck, smoke tests). Webhooks/live charges verified after credentials are added.

Note: online charges and settlements can only be end-to-end tested once you provide Yoco and Netcash credentials. Everything else is fully functional before then.