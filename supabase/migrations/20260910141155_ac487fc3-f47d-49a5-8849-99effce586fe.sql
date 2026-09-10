CREATE OR REPLACE FUNCTION public.can_act_as_finance(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'FINANCE'::app_role)
    OR (
      public.has_role(_user_id, 'ADMIN'::app_role)
      AND NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE p.organization_id = public.get_user_organization(_user_id)
          AND p.status = 'ACTIVE'::user_status
          AND ur.role = 'FINANCE'::app_role
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_act_as_finance(uuid) TO authenticated;

DO $do$
DECLARE
  r record;
  newdef text;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'accept_quote_and_reject_others','add_reimbursement_comment','approve_reimbursement',
        'attach_batch_export_pdf','cancel_batch_draft','confirm_batch_paid','create_payment_batch',
        'create_payment_batch_draft','mark_reimbursement_paid','process_batch_payment',
        'recompute_overdue_invoices','register_batch_export','reject_reimbursement','update_batch_draft'
      )
      AND p.prosrc LIKE '%has_role(_user_id, ''FINANCE''::app_role)%'
  LOOP
    newdef := replace(r.def, 'has_role(_user_id, ''FINANCE''::app_role)', 'public.can_act_as_finance(_user_id)');
    EXECUTE newdef;
  END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION public.get_approved_not_paid_queue()
RETURNS TABLE(transaction_id uuid, pr_id uuid, pr_transaction_ref text, organization_id uuid, supplier_name text, requested_by_name text, requested_by_department text, amount numeric, amount_paid numeric, amount_remaining numeric, currency text, status text, approved_at timestamp with time zone, invoice_id uuid, document_url text, category_name text, project_name text, donor_name text, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
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
      )                                            AS has_active_quote_flow,
      COALESCE((
        SELECT SUM(pa.amount_paid)
        FROM public.payment_allocations pa
        JOIN public.payment_batches pb ON pb.id = pa.batch_id
        WHERE pb.status <> 'CANCELLED'
          AND (
            pa.transaction_id = t.id
            OR (t.invoice_id IS NOT NULL AND pa.invoice_id = t.invoice_id)
          )
      ), 0)                                        AS batched_amount
    FROM public.transactions t
    LEFT JOIN public.purchase_requisitions pr ON pr.id = t.pr_id
    LEFT JOIN public.categories           c  ON c.id  = pr.category_id
    LEFT JOIN public.donation_projects    dp ON dp.id = pr.project_id
    LEFT JOIN public.organization_donors  dn ON dn.id = pr.donor_id
    WHERE t.organization_id = (SELECT org FROM me)
      AND t.status IN ('FINANCE_APPROVED','QUOTE_ACCEPTED','SUPPLIER_INVOICE','AWAITING_PAYMENT','PAYMENT_BATCH','INVOICED','APPROVED_NOT_PAID','PARTIALLY_PAID')
  )
  SELECT
    b.transaction_id, b.pr_id, b.pr_transaction_ref, b.organization_id,
    b.supplier_name, b.requested_by_name, b.requested_by_department,
    b.amount, b.amount_paid, b.amount_remaining, b.currency, b.status,
    b.approved_at, b.invoice_id, b.document_url,
    b.category_name, b.project_name, b.donor_name, b.source
  FROM base b
  WHERE NOT (
    b.status IN ('FINANCE_APPROVED','QUOTE_ACCEPTED')
    AND b.has_active_quote_flow
    AND b.invoice_id IS NULL
  )
  AND b.batched_amount <= 0
  AND b.amount_paid <= 0
  ORDER BY b.approved_at DESC NULLS LAST;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_approved_not_paid_queue() TO authenticated;