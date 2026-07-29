-- 1) Proof of payment on batches
ALTER TABLE public.payment_batches
  ADD COLUMN IF NOT EXISTS pop_file_path text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pop_uploaded_by uuid;

-- 2) Sync transaction status when a supplier invoice is marked awaiting payment
CREATE OR REPLACE FUNCTION public.tg_invoice_sync_awaiting_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'AWAITING_PAYMENT' AND COALESCE(OLD.status,'') <> 'AWAITING_PAYMENT' THEN
    UPDATE public.transactions t
    SET status = 'AWAITING_PAYMENT',
        invoice_id = COALESCE(t.invoice_id, NEW.id),
        document_url = COALESCE(t.document_url, NEW.document_url),
        invoiced_at = COALESCE(t.invoiced_at, now()),
        updated_at = now()
    WHERE (t.id = NEW.transaction_id OR (NEW.transaction_id IS NULL AND t.pr_id = NEW.pr_id))
      AND t.status NOT IN ('COMPLETED','PAID','CANCELLED');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_sync_awaiting_payment ON public.invoices;
CREATE TRIGGER trg_invoice_sync_awaiting_payment
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_sync_awaiting_payment();

-- 3) Reimbursement final approval settles the originating transaction
CREATE OR REPLACE FUNCTION public.admin_approve_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF NOT has_role(_user_id, 'ADMIN'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Admin can give final approval');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text <> 'APPROVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement is not awaiting final approval');
  END IF;

  UPDATE public.reimbursements
  SET status = 'AWAITING_PAYMENT', updated_at = now()
  WHERE id = _reimbursement_id;

  -- The employee already paid the supplier, so the originating transaction is
  -- settled. Only the reimbursement claim remains payable to the employee.
  IF _r.pr_id IS NOT NULL THEN
    UPDATE public.transactions t
    SET status = 'COMPLETED',
        amount_paid = t.amount,
        paid_at = COALESCE(t.paid_at, now()),
        updated_at = now()
    WHERE t.pr_id = _r.pr_id
      AND t.organization_id = _org_id
      AND t.status NOT IN ('COMPLETED','CANCELLED');

    INSERT INTO public.payment_audit_log (organization_id, transaction_id, action, new_status, amount, performed_by, notes)
    SELECT _org_id, t.id, 'SETTLED_BY_EMPLOYEE', 'COMPLETED', t.amount, _user_id,
           'Paid directly by employee; reimbursement ' || _reimbursement_id::text || ' queued for payout'
    FROM public.transactions t
    WHERE t.pr_id = _r.pr_id AND t.organization_id = _org_id;
  END IF;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'ADMIN_FINAL_APPROVED', 'APPROVED', 'AWAITING_PAYMENT', _user_id, _notes);

  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'reimbursement_approved', 'Reimbursement approved',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' received final approval and is awaiting payment.', _r.id::text);
  PERFORM public._notify_role('FINANCE', _org_id,
    'reimbursement_approved', 'Reimbursement cleared for payment',
    _r.employee_name || '''s reimbursement of ' || _r.currency || ' ' || _r.amount || ' received final approval and can be paid.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4) Batch confirmation: proof of payment + unique per-line references
CREATE OR REPLACE FUNCTION public.confirm_batch_paid(
  _batch_id uuid,
  _payment_reference text DEFAULT NULL::text,
  _payment_date date DEFAULT NULL::date,
  _pop_path text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      payment_reference = _payment_reference,
      pop_file_path = COALESCE(_pop_path, pop_file_path),
      pop_uploaded_at = CASE WHEN _pop_path IS NOT NULL THEN now() ELSE pop_uploaded_at END,
      pop_uploaded_by = CASE WHEN _pop_path IS NOT NULL THEN _user_id ELSE pop_uploaded_by END
  WHERE id = _batch_id;

  -- Assign a unique, human-readable reference to every line in the batch,
  -- e.g. BATCH-0007-01, BATCH-0007-02 ...
  WITH numbered AS (
    SELECT pa.id, row_number() OVER (ORDER BY pa.created_at, pa.id) AS rn
    FROM public.payment_allocations pa
    WHERE pa.batch_id = _batch_id
  )
  UPDATE public.payment_allocations pa
  SET payment_reference = _batch.batch_number || '-' || lpad(n.rn::text, 2, '0'),
      payment_date = COALESCE(_payment_date, CURRENT_DATE)
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
    SET status = _new_status,
        transaction_id = _alloc.transaction_id,
        updated_at = now()
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
    SELECT pa.id, pa.payment_reference AS line_ref, pa.reimbursement_id, pa.amount_paid,
           r.status::text AS r_status, r.employee_id, r.currency, r.amount AS r_amount
    FROM public.payment_allocations pa
    JOIN public.reimbursements r ON r.id = pa.reimbursement_id
    WHERE pa.batch_id = _batch_id AND pa.reimbursement_id IS NOT NULL
  LOOP
    UPDATE public.reimbursements
    SET status = 'PAID', paid_at = now(), updated_at = now(),
        reimbursement_reference = COALESCE(_alloc.line_ref, reimbursement_reference),
        reimbursement_date = COALESCE(_payment_date, CURRENT_DATE)
    WHERE id = _alloc.reimbursement_id;

    INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
    VALUES (_org_id, _alloc.reimbursement_id, 'BATCH_PAID', _alloc.r_status, 'PAID', _user_id, _alloc.line_ref);

    PERFORM public._notify_users(ARRAY[_alloc.employee_id], _org_id,
      'full_payment', 'Reimbursement paid',
      'Your reimbursement of ' || _alloc.currency || ' ' || _alloc.r_amount || ' has been paid (ref ' || COALESCE(_alloc.line_ref, _batch.batch_number) || ').',
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
$$;

REVOKE ALL ON FUNCTION public.confirm_batch_paid(uuid, text, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_batch_paid(uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_reimbursement(uuid, text) TO authenticated;