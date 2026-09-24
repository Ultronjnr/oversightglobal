ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'standard_exclusive',
  ADD COLUMN IF NOT EXISTS total_amount numeric;

UPDATE public.quotes
SET vat_treatment = CASE
  WHEN COALESCE(vat_amount, 0) > 0 THEN 'custom'
  ELSE 'standard_exclusive'
END,
total_amount = amount
WHERE total_amount IS NULL;

ALTER TABLE public.quotes
  ALTER COLUMN total_amount SET DEFAULT 0,
  ALTER COLUMN total_amount SET NOT NULL;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_vat_treatment_valid
  CHECK (vat_treatment IN ('standard_exclusive', 'standard_inclusive', 'zero_rated', 'exempt', 'not_registered', 'custom'));

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_total_amount_nonnegative
  CHECK (total_amount >= 0);