
-- 0) Deduplicate existing rows before adding unique indexes.
DELETE FROM public.payment_allocations a
USING public.payment_allocations b
WHERE a.batch_id = b.batch_id
  AND a.transaction_id IS NOT NULL
  AND a.transaction_id = b.transaction_id
  AND a.created_at > b.created_at;

DELETE FROM public.payment_allocations a
USING public.payment_allocations b
WHERE a.batch_id = b.batch_id
  AND a.invoice_id IS NOT NULL
  AND a.invoice_id = b.invoice_id
  AND a.created_at > b.created_at;

DELETE FROM public.payment_allocations a
USING public.payment_allocations b
WHERE a.batch_id = b.batch_id
  AND a.reimbursement_id IS NOT NULL
  AND a.reimbursement_id = b.reimbursement_id
  AND a.created_at > b.created_at;

-- Handle any remaining exact-timestamp ties by id ordering.
DELETE FROM public.payment_allocations a
USING public.payment_allocations b
WHERE a.batch_id = b.batch_id
  AND a.transaction_id IS NOT NULL
  AND a.transaction_id = b.transaction_id
  AND a.created_at = b.created_at
  AND a.id > b.id;

-- 1) Idempotency: prevent the same payable being added twice inside the same batch.
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_allocations_batch_txn
  ON public.payment_allocations(batch_id, transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_allocations_batch_invoice
  ON public.payment_allocations(batch_id, invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_allocations_batch_reimb
  ON public.payment_allocations(batch_id, reimbursement_id)
  WHERE reimbursement_id IS NOT NULL;

-- 2) Reconciliation: when a supplier invoice arrives for a PR, immediately lock
--    the PR out of the finance incoming queue by advancing its status.
CREATE OR REPLACE FUNCTION public.tg_invoice_lock_pr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.purchase_requisitions
     SET status = CASE
       WHEN status IN ('FULFILLED','CLOSED','PAID') THEN status
       ELSE 'FINANCE_APPROVED'
     END,
     pr_locked = true,
     updated_at = now()
   WHERE id = NEW.pr_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_invoice_lock_pr() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_invoice_lock_pr_on_insert ON public.invoices;
CREATE TRIGGER trg_invoice_lock_pr_on_insert
  AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_lock_pr();

-- 3) Single backend mapping for "Approved – Not Paid".
CREATE OR REPLACE FUNCTION public.get_approved_not_paid_queue()
RETURNS TABLE (
  transaction_id uuid,
  pr_id uuid,
  pr_transaction_ref text,
  organization_id uuid,
  supplier_name text,
  requested_by_name text,
  requested_by_department text,
  amount numeric,
  amount_paid numeric,
  amount_remaining numeric,
  currency text,
  status text,
  approved_at timestamptz,
  invoice_id uuid,
  document_url text,
  category_name text,
  project_name text,
  donor_name text,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (
    SELECT public.get_user_organization(auth.uid()) AS org
  ),
  base AS (
    SELECT
      t.id                                         AS transaction_id,
      t.pr_id                                      AS pr_id,
      COALESCE(pr.transaction_id, 'TX-' || substr(t.id::text, 1, 8)) AS pr_transaction_ref,
      t.organization_id,
      COALESCE(t.supplier_name, pr.requested_by_name, 'Approved Transaction') AS supplier_name,
      pr.requested_by_name,
      pr.requested_by_department,
      t.amount,
      COALESCE(t.amount_paid, 0)                   AS amount_paid,
      GREATEST(COALESCE(t.amount,0) - COALESCE(t.amount_paid,0), 0) AS amount_remaining,
      t.currency,
      t.status,
      t.approved_at,
      t.invoice_id,
      COALESCE(t.document_url, pr.document_url)    AS document_url,
      c.name                                       AS category_name,
      dp.name                                      AS project_name,
      dn.name                                      AS donor_name,
      CASE
        WHEN t.invoice_id IS NOT NULL OR t.status IN ('SUPPLIER_INVOICE','AWAITING_PAYMENT','INVOICED')
          THEN 'INVOICE_FLOW'
        ELSE 'DIRECT_APPROVAL'
      END                                          AS source,
      EXISTS (
        SELECT 1 FROM public.quote_requests qr
        WHERE qr.pr_id = t.pr_id
          AND qr.status NOT IN ('DECLINED','CANCELLED')
      )                                            AS has_active_quote_flow
    FROM public.transactions t
    LEFT JOIN public.purchase_requisitions pr ON pr.id = t.pr_id
    LEFT JOIN public.categories           c  ON c.id  = pr.category_id
    LEFT JOIN public.donation_projects    dp ON dp.id = pr.project_id
    LEFT JOIN public.organization_donors  dn ON dn.id = pr.donor_id
    WHERE t.organization_id = (SELECT org FROM me)
      AND t.status IN ('FINANCE_APPROVED','SUPPLIER_INVOICE','AWAITING_PAYMENT','PAYMENT_BATCH','INVOICED','APPROVED_NOT_PAID','PARTIALLY_PAID')
  )
  SELECT
    b.transaction_id, b.pr_id, b.pr_transaction_ref, b.organization_id,
    b.supplier_name, b.requested_by_name, b.requested_by_department,
    b.amount, b.amount_paid, b.amount_remaining, b.currency, b.status,
    b.approved_at, b.invoice_id, b.document_url,
    b.category_name, b.project_name, b.donor_name, b.source
  FROM base b
  -- FINANCE_APPROVED rows still in an active quote/RFQ flow with no invoice yet
  -- belong to the quote pipeline, not this payables queue.
  WHERE NOT (
    b.status = 'FINANCE_APPROVED'
    AND b.has_active_quote_flow
    AND b.invoice_id IS NULL
  )
  ORDER BY b.approved_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_not_paid_queue() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_approved_not_paid_queue() FROM anon, public;
