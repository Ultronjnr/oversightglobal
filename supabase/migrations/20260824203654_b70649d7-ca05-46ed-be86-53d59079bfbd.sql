ALTER TABLE public.quotes
  ALTER COLUMN quote_request_id DROP NOT NULL,
  ALTER COLUMN supplier_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'PORTAL',
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS captured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_source_check CHECK (source IN ('PORTAL','MANUAL'));

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_supplier_identity_check
  CHECK (supplier_id IS NOT NULL OR supplier_name IS NOT NULL);

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS winning_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_pr_source ON public.quotes(pr_id, source);

-- Internal staff (FINANCE/ADMIN/HOD) may capture and maintain manual quotes in their own org.
CREATE POLICY "Internal staff insert manual quotes"
ON public.quotes FOR INSERT TO authenticated
WITH CHECK (
  source = 'MANUAL'
  AND organization_id = public.get_user_organization(auth.uid())
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
  )
);

CREATE POLICY "Internal staff update manual quotes"
ON public.quotes FOR UPDATE TO authenticated
USING (
  source = 'MANUAL'
  AND status <> 'ACCEPTED'
  AND organization_id = public.get_user_organization(auth.uid())
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
  )
)
WITH CHECK (
  source = 'MANUAL'
  AND organization_id = public.get_user_organization(auth.uid())
);

CREATE POLICY "Internal staff delete manual quotes"
ON public.quotes FOR DELETE TO authenticated
USING (
  source = 'MANUAL'
  AND status <> 'ACCEPTED'
  AND organization_id = public.get_user_organization(auth.uid())
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
  )
);

CREATE OR REPLACE FUNCTION public.accept_quote_and_reject_others(_quote_id uuid, _pr_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _caller_org_id uuid;
  _quote_record record;
  _supplier_name text;
  _txn_id uuid;
BEGIN
  _caller_org_id := get_user_organization(_user_id);

  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can accept quotes');
  END IF;

  SELECT q.* INTO _quote_record
  FROM public.quotes q
  WHERE q.id = _quote_id
    AND q.pr_id = _pr_id
    AND q.organization_id = _caller_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;

  IF _quote_record.status <> 'SUBMITTED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is not in a state that can be accepted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quotes
    WHERE pr_id = _pr_id
      AND status = 'ACCEPTED'
      AND id <> _quote_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A quote for this PR has already been accepted');
  END IF;

  SELECT s.company_name INTO _supplier_name
  FROM public.suppliers s
  WHERE s.id = _quote_record.supplier_id;

  _supplier_name := COALESCE(_supplier_name, _quote_record.supplier_name);

  _txn_id := public.ensure_transaction_for_pr(
    _pr_id,
    _quote_record.supplier_id,
    _supplier_name,
    _quote_record.amount,
    _quote_record.document_url,
    NULL,
    false,
    'QUOTE_ACCEPTED'
  );

  UPDATE public.quotes
  SET status = 'ACCEPTED', updated_at = now(), transaction_id = _txn_id
  WHERE id = _quote_id;

  UPDATE public.quotes
  SET status = 'REJECTED', updated_at = now(), transaction_id = COALESCE(transaction_id, _txn_id)
  WHERE pr_id = _pr_id
    AND id <> _quote_id
    AND status = 'SUBMITTED';

  UPDATE public.transactions
  SET supplier_id = COALESCE(supplier_id, _quote_record.supplier_id),
      supplier_name = COALESCE(supplier_name, _supplier_name),
      amount = CASE WHEN amount_paid = 0 THEN _quote_record.amount ELSE amount END,
      document_url = COALESCE(document_url, _quote_record.document_url),
      status = CASE WHEN status IN ('PAID','COMPLETED','FULLY_PAID') THEN status ELSE 'QUOTE_ACCEPTED' END,
      updated_at = now()
  WHERE id = _txn_id;

  UPDATE public.purchase_requisitions
  SET winning_quote_id = _quote_id, updated_at = now()
  WHERE id = _pr_id;

  UPDATE public.quote_requests
  SET transaction_id = _txn_id
  WHERE pr_id = _pr_id AND transaction_id IS NULL;

  RETURN jsonb_build_object('success', true, 'accepted_quote_id', _quote_id, 'transaction_id', _txn_id);
END;
$function$;