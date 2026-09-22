ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_number text,
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quotes_pr_supplier ON public.quotes (pr_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON public.quotes (organization_id, quote_number);