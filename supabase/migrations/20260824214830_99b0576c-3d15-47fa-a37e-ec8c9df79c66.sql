DO $$ BEGIN
  CREATE TYPE public.vat_status AS ENUM ('UNASSESSED','STANDARD','ZERO_RATED','EXEMPT','NOT_REGISTERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS vat_status public.vat_status NOT NULL DEFAULT 'UNASSESSED',
  ADD COLUMN IF NOT EXISTS vat_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vat_note text,
  ADD COLUMN IF NOT EXISTS vat_assessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS vat_assessment_required boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.tg_txn_flag_vat_assessment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.document_url IS NOT NULL OR NEW.invoice_id IS NOT NULL OR NEW.scan_document_path IS NOT NULL THEN
      NEW.vat_assessment_required := true;
      NEW.vat_status := 'UNASSESSED';
      NEW.vat_assessed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.document_url IS DISTINCT FROM OLD.document_url AND NEW.document_url IS NOT NULL)
     OR (NEW.invoice_id IS DISTINCT FROM OLD.invoice_id AND NEW.invoice_id IS NOT NULL)
     OR (NEW.scan_document_path IS DISTINCT FROM OLD.scan_document_path AND NEW.scan_document_path IS NOT NULL)
  THEN
    NEW.vat_assessment_required := true;
    NEW.vat_assessed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_txn_flag_vat_assessment ON public.transactions;
CREATE TRIGGER trg_txn_flag_vat_assessment
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_txn_flag_vat_assessment();

CREATE OR REPLACE FUNCTION public.tg_invoice_flag_vat_assessment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_id IS NOT NULL THEN
    UPDATE public.transactions
       SET vat_assessment_required = true,
           vat_assessed_at = NULL
     WHERE id = NEW.transaction_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_flag_vat_assessment ON public.invoices;
CREATE TRIGGER trg_invoice_flag_vat_assessment
AFTER INSERT OR UPDATE OF document_url, transaction_id ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_flag_vat_assessment();

UPDATE public.transactions
   SET vat_assessment_required = true
 WHERE vat_assessed_at IS NULL
   AND (document_url IS NOT NULL OR invoice_id IS NOT NULL OR scan_document_path IS NOT NULL);