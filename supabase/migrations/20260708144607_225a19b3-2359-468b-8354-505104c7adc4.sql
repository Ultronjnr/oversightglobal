ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS vat_rate numeric(6,2) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS vat_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS exclusive_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS inclusive_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS vat_manual boolean NOT NULL DEFAULT false;

-- Backfill from existing gross amount using the standard 15% inclusive split
UPDATE public.transactions
SET
  inclusive_amount = COALESCE(inclusive_amount, amount),
  exclusive_amount = COALESCE(exclusive_amount, ROUND(amount / 1.15, 2)),
  vat_amount = COALESCE(vat_amount, ROUND(amount - (amount / 1.15), 2))
WHERE amount IS NOT NULL
  AND (inclusive_amount IS NULL OR exclusive_amount IS NULL OR vat_amount IS NULL);

CREATE INDEX IF NOT EXISTS idx_transactions_org_status ON public.transactions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_supplier ON public.transactions(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);