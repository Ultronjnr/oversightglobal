ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_branch_code text,
  ADD COLUMN IF NOT EXISTS bank_account_type text;

CREATE OR REPLACE FUNCTION public.tg_transaction_default_payment_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_reference IS NULL OR btrim(NEW.payment_reference) = '' THEN
    NEW.payment_reference := NULLIF(btrim(COALESCE(NEW.invoice_number, '')), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_default_payment_reference ON public.transactions;
CREATE TRIGGER trg_transaction_default_payment_reference
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_transaction_default_payment_reference();

CREATE INDEX IF NOT EXISTS idx_transactions_payment_reference
  ON public.transactions (organization_id, payment_reference);