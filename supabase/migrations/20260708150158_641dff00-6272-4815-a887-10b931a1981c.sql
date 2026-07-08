-- Add organization currency setting
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ZAR';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_currency_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_currency_check
  CHECK (currency IN ('ZAR', 'USD', 'EUR', 'GBP', 'NAD', 'BWP'));