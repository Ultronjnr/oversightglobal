CREATE OR REPLACE FUNCTION public.get_approved_not_paid_queue()
RETURNS TABLE(transaction_id uuid, pr_id uuid, pr_transaction_ref text, organization_id uuid, supplier_name text, requested_by_name text, requested_by_department text, amount numeric, amount_paid numeric, amount_remaining numeric, currency text, status text, approved_at timestamp with time zone, invoice_id uuid, document_url text, category_name text, project_name text, donor_name text, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
      AND t.status IN ('FINANCE_APPROVED','SUPPLIER_INVOICE','AWAITING_PAYMENT','PAYMENT_BATCH','INVOICED','APPROVED_NOT_PAID','PARTIALLY_PAID')
  )
  SELECT
    b.transaction_id, b.pr_id, b.pr_transaction_ref, b.organization_id,
    b.supplier_name, b.requested_by_name, b.requested_by_department,
    b.amount, b.amount_paid, b.amount_remaining, b.currency, b.status,
    b.approved_at, b.invoice_id, b.document_url,
    b.category_name, b.project_name, b.donor_name, b.source
  FROM base b
  WHERE NOT (
    b.status = 'FINANCE_APPROVED'
    AND b.has_active_quote_flow
    AND b.invoice_id IS NULL
  )
  -- Anything already fully allocated to an active payment batch belongs to the
  -- Batches tab, not this queue (prevents backlog and duplicate batching).
  AND b.batched_amount < COALESCE(b.amount, 0)
  ORDER BY b.approved_at DESC NULLS LAST;
$$;