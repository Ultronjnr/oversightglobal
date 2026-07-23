
-- 1. Fix accept_quote_and_reject_others: FOR UPDATE cannot be used with LEFT JOIN.
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

  -- Lock the quote row only; join to suppliers separately after.
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

  UPDATE public.quote_requests
  SET transaction_id = _txn_id
  WHERE pr_id = _pr_id AND transaction_id IS NULL;

  RETURN jsonb_build_object('success', true, 'accepted_quote_id', _quote_id, 'transaction_id', _txn_id);
END;
$function$;

-- 2. Allow Finance/Admin to upload scanned invoices under their own user folder.
DROP POLICY IF EXISTS "Finance can upload scanned invoice documents" ON storage.objects;
CREATE POLICY "Finance can upload scanned invoice documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
  )
);

-- Allow the same users to read back their own uploads (for OCR/preview).
DROP POLICY IF EXISTS "Finance can view scanned invoice documents" ON storage.objects;
CREATE POLICY "Finance can view scanned invoice documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
  )
);
