-- Layer 2: per-transaction payment reference + per-transaction proof of payment
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS pop_file_path text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pop_uploaded_by uuid;

-- Keep any reference Finance already captured on a line; only auto-number the blanks,
-- and never wipe a batch reference with a null.
CREATE OR REPLACE FUNCTION public.confirm_batch_paid(
  _batch_id uuid,
  _payment_reference text DEFAULT NULL::text,
  _payment_date date DEFAULT NULL::date,
  _pop_path text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch record;
  _alloc record;
  _paid_total numeric;
  _old_status text;
  _new_status text;
  _line_ref text;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can confirm payment batches');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _batch FROM public.payment_batches WHERE id = _batch_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Batch not found'); END IF;
  IF _batch.status <> 'DRAFT' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only draft batches can be confirmed');
  END IF;
  IF _batch.total_amount IS NULL OR _batch.total_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batch is empty');
  END IF;

  UPDATE public.payment_batches
  SET status = 'PAID',
      confirmed_at = now(),
      paid_at = now(),
      payment_reference = COALESCE(_payment_reference, payment_reference),
      pop_file_path = COALESCE(_pop_path, pop_file_path),
      pop_uploaded_at = CASE WHEN _pop_path IS NOT NULL THEN now() ELSE pop_uploaded_at END,
      pop_uploaded_by = CASE WHEN _pop_path IS NOT NULL THEN _user_id ELSE pop_uploaded_by END
  WHERE id = _batch_id;

  -- Auto-number only the lines Finance did not reference themselves.
  WITH numbered AS (
    SELECT pa.id, row_number() OVER (ORDER BY pa.created_at, pa.id) AS rn
    FROM public.payment_allocations pa
    WHERE pa.batch_id = _batch_id
  )
  UPDATE public.payment_allocations pa
  SET payment_reference = COALESCE(NULLIF(btrim(pa.payment_reference), ''),
                                   _batch.batch_number || '-' || lpad(n.rn::text, 2, '0')),
      payment_date = COALESCE(pa.payment_date, _payment_date, CURRENT_DATE)
  FROM numbered n
  WHERE pa.id = n.id;

  FOR _alloc IN
    SELECT pa.id, pa.payment_reference AS line_ref, pa.invoice_id,
           COALESCE(pa.transaction_id, i.transaction_id, t.id) AS transaction_id,
           pa.amount_paid, i.status AS inv_status, i.quote_id, i.pr_id,
           COALESCE(q.amount, t.amount) AS target_amount
    FROM public.payment_allocations pa
    JOIN public.invoices i ON i.id = pa.invoice_id
    JOIN public.quotes q ON q.id = i.quote_id
    LEFT JOIN public.transactions t ON t.pr_id = i.pr_id
    WHERE pa.batch_id = _batch_id AND pa.invoice_id IS NOT NULL
  LOOP
    _line_ref := _alloc.line_ref;

    UPDATE public.payment_allocations
    SET transaction_id = _alloc.transaction_id
    WHERE id = _alloc.id;

    SELECT COALESCE(SUM(pa.amount_paid),0) INTO _paid_total
    FROM public.payment_allocations pa
    JOIN public.payment_batches pb ON pb.id = pa.batch_id
    WHERE pa.transaction_id = _alloc.transaction_id AND pb.status IN ('CONFIRMED','PAID');

    _old_status := _alloc.inv_status;
    IF _paid_total >= _alloc.target_amount THEN _new_status := 'PAID'; ELSE _new_status := 'PARTIALLY_PAID'; END IF;

    UPDATE public.invoices
    SET status = _new_status, transaction_id = _alloc.transaction_id, updated_at = now()
    WHERE id = _alloc.invoice_id;

    UPDATE public.transactions
    SET amount_paid = _paid_total,
        status = CASE WHEN _new_status = 'PAID' THEN 'COMPLETED' ELSE 'PAYMENT_BATCH' END,
        paid_at = CASE WHEN _new_status = 'PAID' THEN now() ELSE paid_at END,
        invoice_id = COALESCE(invoice_id, _alloc.invoice_id),
        updated_at = now()
    WHERE id = _alloc.transaction_id;

    INSERT INTO public.payment_audit_log (organization_id, invoice_id, transaction_id, batch_id, action, old_status, new_status, amount, performed_by, notes)
    VALUES (_org_id, _alloc.invoice_id, _alloc.transaction_id, _batch_id, 'BATCH_CONFIRMED', _old_status, _new_status, _alloc.amount_paid, _user_id, _line_ref);

    IF _new_status = 'PAID' THEN
      UPDATE public.quotes SET status = 'COMPLETED', transaction_id = _alloc.transaction_id, updated_at = now()
      WHERE id = _alloc.quote_id AND status <> 'COMPLETED';

      UPDATE public.purchase_requisitions SET status = 'CLOSED', updated_at = now()
      WHERE id = _alloc.pr_id AND status <> 'CLOSED';
    END IF;
  END LOOP;

  FOR _alloc IN
    SELECT pa.id, pa.payment_reference AS line_ref, pa.payment_date, pa.reimbursement_id, pa.amount_paid,
           r.status::text AS r_status, r.employee_id, r.currency, r.amount AS r_amount
    FROM public.payment_allocations pa
    JOIN public.reimbursements r ON r.id = pa.reimbursement_id
    WHERE pa.batch_id = _batch_id AND pa.reimbursement_id IS NOT NULL
  LOOP
    UPDATE public.reimbursements
    SET status = 'PAID', paid_at = now(), updated_at = now(),
        reimbursement_reference = COALESCE(_alloc.line_ref, reimbursement_reference),
        reimbursement_date = COALESCE(_alloc.payment_date, CURRENT_DATE)
    WHERE id = _alloc.reimbursement_id;

    INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
    VALUES (_org_id, _alloc.reimbursement_id, 'BATCH_PAID', _alloc.r_status, 'PAID', _user_id, _alloc.line_ref);

    PERFORM public._notify_users(ARRAY[_alloc.employee_id], _org_id,
      'full_payment', 'Reimbursement paid',
      'Your reimbursement of ' || _alloc.currency || ' ' || _alloc.r_amount || ' has been paid in batch ' || _batch.batch_number || '.',
      _alloc.reimbursement_id::text);
  END LOOP;

  FOR _alloc IN
    SELECT pa.id, pa.payment_reference AS line_ref, pa.transaction_id, pa.amount_paid,
           t.amount AS target_amount, t.status AS txn_status
    FROM public.payment_allocations pa
    JOIN public.transactions t ON t.id = pa.transaction_id
    WHERE pa.batch_id = _batch_id AND pa.transaction_id IS NOT NULL AND pa.invoice_id IS NULL
  LOOP
    SELECT COALESCE(SUM(pa.amount_paid),0) INTO _paid_total
    FROM public.payment_allocations pa
    JOIN public.payment_batches pb ON pb.id = pa.batch_id
    WHERE pa.transaction_id = _alloc.transaction_id AND pb.status IN ('CONFIRMED','PAID');

    IF _paid_total >= _alloc.target_amount THEN _new_status := 'COMPLETED'; ELSE _new_status := 'PAYMENT_BATCH'; END IF;

    UPDATE public.transactions
    SET amount_paid = _paid_total,
        status = _new_status,
        paid_at = CASE WHEN _new_status = 'COMPLETED' THEN now() ELSE paid_at END,
        updated_at = now()
    WHERE id = _alloc.transaction_id;

    INSERT INTO public.payment_audit_log (organization_id, transaction_id, batch_id, action, old_status, new_status, amount, performed_by, notes)
    VALUES (_org_id, _alloc.transaction_id, _batch_id, 'BATCH_CONFIRMED', _alloc.txn_status, _new_status, _alloc.amount_paid, _user_id, _alloc.line_ref);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Process a batch line by line: every line carries its own mandatory reference,
-- optional proof of payment and payment date, then the batch is settled.
CREATE OR REPLACE FUNCTION public.process_batch_payment(
  _batch_id uuid,
  _lines jsonb,
  _payment_date date DEFAULT NULL::date
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch record;
  _line jsonb;
  _alloc_id uuid;
  _ref text;
  _pop text;
  _date date;
  _missing int;
  _dup text;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can process payment batches');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _batch FROM public.payment_batches
   WHERE id = _batch_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Batch not found'); END IF;
  IF _batch.status <> 'DRAFT' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This batch has already been processed');
  END IF;

  FOR _line IN SELECT * FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb))
  LOOP
    _alloc_id := (_line->>'allocation_id')::uuid;
    _ref := NULLIF(btrim(COALESCE(_line->>'payment_reference', '')), '');
    _pop := NULLIF(btrim(COALESCE(_line->>'pop_file_path', '')), '');
    _date := COALESCE((_line->>'payment_date')::date, _payment_date, CURRENT_DATE);

    UPDATE public.payment_allocations
       SET payment_reference = _ref,
           payment_date = _date,
           pop_file_path = COALESCE(_pop, pop_file_path),
           pop_uploaded_at = CASE WHEN _pop IS NOT NULL THEN now() ELSE pop_uploaded_at END,
           pop_uploaded_by = CASE WHEN _pop IS NOT NULL THEN _user_id ELSE pop_uploaded_by END
     WHERE id = _alloc_id AND batch_id = _batch_id AND organization_id = _org_id;
  END LOOP;

  SELECT count(*) INTO _missing
    FROM public.payment_allocations
   WHERE batch_id = _batch_id
     AND NULLIF(btrim(COALESCE(payment_reference, '')), '') IS NULL;
  IF _missing > 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', format('%s payment(s) in this batch still need a payment reference', _missing));
  END IF;

  SELECT pa.payment_reference INTO _dup
    FROM public.payment_allocations pa
   WHERE pa.organization_id = _org_id
     AND pa.batch_id = _batch_id
     AND EXISTS (
       SELECT 1 FROM public.payment_allocations o
        WHERE o.organization_id = _org_id
          AND o.id <> pa.id
          AND btrim(lower(o.payment_reference)) = btrim(lower(pa.payment_reference))
     )
   LIMIT 1;
  IF _dup IS NOT NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', format('Payment reference "%s" is already used by another payment', _dup));
  END IF;

  RETURN public.confirm_batch_paid(_batch_id, NULL, _payment_date, NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_batch_payment(uuid, jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_batch_payment(uuid, jsonb, date) TO authenticated;