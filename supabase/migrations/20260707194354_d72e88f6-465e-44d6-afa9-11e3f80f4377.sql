
-- 0. Allow the new INVOICED state
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status = ANY (ARRAY['APPROVED_NOT_PAID'::text, 'INVOICED'::text, 'PARTIALLY_PAID'::text, 'FULLY_PAID'::text]));

-- 1. Extend transactions to carry invoice linkage + document + invoiced state
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS invoiced_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON public.transactions(invoice_id);

-- 2. Trigger: when a supplier invoice is created/updated, fold it into the
--    single transaction for that PR (state -> INVOICED), never a second row.
CREATE OR REPLACE FUNCTION public.tg_invoice_fold_into_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _quote_amount numeric;
  _supplier_id uuid;
  _supplier_name text;
BEGIN
  SELECT q.amount, q.supplier_id, s.company_name
    INTO _quote_amount, _supplier_id, _supplier_name
  FROM public.quotes q
  LEFT JOIN public.suppliers s ON s.id = q.supplier_id
  WHERE q.id = NEW.quote_id;

  INSERT INTO public.transactions (
    pr_id, organization_id, supplier_id, supplier_name,
    amount, currency, status, approved_at,
    invoice_id, document_url, invoiced_at
  )
  SELECT
    NEW.pr_id, NEW.organization_id, _supplier_id, _supplier_name,
    COALESCE(_quote_amount, pr.total_amount, 0), COALESCE(pr.currency, 'ZAR'),
    'INVOICED', now(),
    NEW.id, NEW.document_url, now()
  FROM public.purchase_requisitions pr
  WHERE pr.id = NEW.pr_id
  ON CONFLICT (pr_id) DO UPDATE
    SET status = CASE
                   WHEN public.transactions.status = 'APPROVED_NOT_PAID'
                     THEN 'INVOICED'
                   ELSE public.transactions.status
                 END,
        invoice_id = EXCLUDED.invoice_id,
        document_url = COALESCE(EXCLUDED.document_url, public.transactions.document_url),
        invoiced_at = COALESCE(public.transactions.invoiced_at, EXCLUDED.invoiced_at),
        amount = CASE
                   WHEN public.transactions.amount_paid = 0 AND EXCLUDED.amount > 0
                     THEN EXCLUDED.amount
                   ELSE public.transactions.amount
                 END,
        supplier_id = COALESCE(public.transactions.supplier_id, EXCLUDED.supplier_id),
        supplier_name = COALESCE(public.transactions.supplier_name, EXCLUDED.supplier_name),
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_fold_into_transaction ON public.invoices;
CREATE TRIGGER trg_invoice_fold_into_transaction
  AFTER INSERT OR UPDATE OF document_url, quote_id ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_invoice_fold_into_transaction();

-- 3. When an invoiced transaction is fully paid, close out invoice/quote/PR.
CREATE OR REPLACE FUNCTION public.tg_transaction_settle_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'FULLY_PAID'
     AND OLD.status IS DISTINCT FROM 'FULLY_PAID'
     AND NEW.invoice_id IS NOT NULL THEN

    UPDATE public.invoices
      SET status = 'PAID', updated_at = now()
      WHERE id = NEW.invoice_id AND status <> 'PAID';

    UPDATE public.quotes q
      SET status = 'COMPLETED', updated_at = now()
      FROM public.invoices i
      WHERE i.id = NEW.invoice_id AND q.id = i.quote_id AND q.status <> 'COMPLETED';

    UPDATE public.purchase_requisitions
      SET status = 'CLOSED', updated_at = now()
      WHERE id = NEW.pr_id AND status <> 'CLOSED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_settle_invoice ON public.transactions;
CREATE TRIGGER trg_transaction_settle_invoice
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_transaction_settle_invoice();

-- 4. Backfill: merge existing duplicate (transaction + open invoice) pairs.
UPDATE public.transactions t
SET status = CASE WHEN t.status = 'APPROVED_NOT_PAID' THEN 'INVOICED' ELSE t.status END,
    invoice_id = i.id,
    document_url = COALESCE(t.document_url, i.document_url),
    invoiced_at = COALESCE(t.invoiced_at, i.created_at),
    amount = CASE WHEN t.amount_paid = 0 AND q.amount > 0 THEN q.amount ELSE t.amount END,
    updated_at = now()
FROM public.invoices i
LEFT JOIN public.quotes q ON q.id = i.quote_id
WHERE i.pr_id = t.pr_id
  AND t.invoice_id IS NULL
  AND i.status IN ('UPLOADED','AWAITING_PAYMENT','OVERDUE','PARTIALLY_PAID');
