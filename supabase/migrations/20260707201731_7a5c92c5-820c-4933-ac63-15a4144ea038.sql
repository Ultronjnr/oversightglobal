-- Normalize transaction lifecycle around one permanent transaction row per PR.

-- 1) Allow normalized lifecycle statuses while retaining legacy statuses during transition.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status = ANY (ARRAY[
    'REQUEST_CREATED'::text,
    'FINANCE_APPROVED'::text,
    'SUPPLIER_QUOTE'::text,
    'QUOTE_ACCEPTED'::text,
    'SUPPLIER_INVOICE'::text,
    'AWAITING_PAYMENT'::text,
    'PAYMENT_BATCH'::text,
    'PAID'::text,
    'COMPLETED'::text,
    -- legacy states still accepted for old rows/client compatibility
    'APPROVED_NOT_PAID'::text,
    'INVOICED'::text,
    'PARTIALLY_PAID'::text,
    'FULLY_PAID'::text
  ]));

-- 2) Replace resolver with status-aware version. Existing callers keep working.
CREATE OR REPLACE FUNCTION public.ensure_transaction_for_pr(
  _pr_id uuid,
  _supplier_id uuid DEFAULT NULL,
  _supplier_name text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _document_url text DEFAULT NULL,
  _invoice_id uuid DEFAULT NULL,
  _mark_invoiced boolean DEFAULT false,
  _status text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _txn_id uuid;
  _pr record;
  _resolved_supplier_id uuid := _supplier_id;
  _resolved_supplier_name text := NULLIF(trim(COALESCE(_supplier_name, '')), '');
  _resolved_amount numeric := _amount;
  _target_status text := COALESCE(_status, CASE WHEN _mark_invoiced THEN 'SUPPLIER_INVOICE' ELSE 'REQUEST_CREATED' END);
BEGIN
  SELECT * INTO _pr
  FROM public.purchase_requisitions
  WHERE id = _pr_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase requisition % not found', _pr_id;
  END IF;

  IF _resolved_supplier_id IS NULL OR _resolved_supplier_name IS NULL THEN
    SELECT q.supplier_id, COALESCE(_resolved_supplier_name, s.company_name)
      INTO _resolved_supplier_id, _resolved_supplier_name
    FROM public.quotes q
    LEFT JOIN public.suppliers s ON s.id = q.supplier_id
    WHERE q.pr_id = _pr_id
      AND q.status IN ('ACCEPTED','INVOICE_UPLOADED','COMPLETED')
    ORDER BY CASE q.status WHEN 'ACCEPTED' THEN 1 WHEN 'INVOICE_UPLOADED' THEN 2 ELSE 3 END, q.updated_at DESC
    LIMIT 1;
  END IF;

  IF _resolved_supplier_name IS NULL
     AND jsonb_typeof(_pr.items) = 'array'
     AND jsonb_array_length(_pr.items) > 0 THEN
    _resolved_supplier_name := NULLIF(trim(COALESCE(_pr.items->0->>'supplier_preference','')), '');
  END IF;

  _resolved_amount := COALESCE(_resolved_amount, _pr.total_amount, 0);

  INSERT INTO public.transactions (
    pr_id,
    organization_id,
    supplier_id,
    supplier_name,
    amount,
    currency,
    status,
    approved_at,
    invoice_id,
    document_url,
    invoiced_at
  ) VALUES (
    _pr.id,
    _pr.organization_id,
    _resolved_supplier_id,
    _resolved_supplier_name,
    _resolved_amount,
    COALESCE(_pr.currency, 'ZAR'),
    _target_status,
    now(),
    _invoice_id,
    _document_url,
    CASE WHEN _mark_invoiced THEN now() ELSE NULL END
  )
  ON CONFLICT (pr_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        supplier_id = COALESCE(public.transactions.supplier_id, EXCLUDED.supplier_id),
        supplier_name = COALESCE(public.transactions.supplier_name, EXCLUDED.supplier_name),
        amount = CASE
          WHEN public.transactions.amount_paid = 0
            THEN COALESCE(NULLIF(EXCLUDED.amount, 0), public.transactions.amount)
          ELSE public.transactions.amount
        END,
        currency = COALESCE(EXCLUDED.currency, public.transactions.currency),
        status = CASE
          WHEN public.transactions.status IN ('PAID','COMPLETED','FULLY_PAID') THEN public.transactions.status
          WHEN _target_status = 'REQUEST_CREATED' THEN public.transactions.status
          WHEN _target_status = 'FINANCE_APPROVED' AND public.transactions.status IN ('REQUEST_CREATED','APPROVED_NOT_PAID') THEN 'FINANCE_APPROVED'
          WHEN _target_status = 'SUPPLIER_QUOTE' AND public.transactions.status IN ('REQUEST_CREATED','APPROVED_NOT_PAID','FINANCE_APPROVED') THEN 'SUPPLIER_QUOTE'
          WHEN _target_status = 'QUOTE_ACCEPTED' AND public.transactions.status IN ('REQUEST_CREATED','APPROVED_NOT_PAID','FINANCE_APPROVED','SUPPLIER_QUOTE') THEN 'QUOTE_ACCEPTED'
          WHEN _target_status = 'SUPPLIER_INVOICE' AND public.transactions.status IN ('REQUEST_CREATED','APPROVED_NOT_PAID','FINANCE_APPROVED','SUPPLIER_QUOTE','QUOTE_ACCEPTED','INVOICED') THEN 'SUPPLIER_INVOICE'
          WHEN _target_status = 'AWAITING_PAYMENT' AND public.transactions.status IN ('REQUEST_CREATED','APPROVED_NOT_PAID','FINANCE_APPROVED','SUPPLIER_QUOTE','QUOTE_ACCEPTED','SUPPLIER_INVOICE','INVOICED') THEN 'AWAITING_PAYMENT'
          WHEN _target_status = 'PAYMENT_BATCH' AND public.transactions.status IN ('REQUEST_CREATED','APPROVED_NOT_PAID','FINANCE_APPROVED','SUPPLIER_QUOTE','QUOTE_ACCEPTED','SUPPLIER_INVOICE','INVOICED','AWAITING_PAYMENT','PARTIALLY_PAID') THEN 'PAYMENT_BATCH'
          WHEN _target_status IN ('PAID','COMPLETED') THEN _target_status
          ELSE public.transactions.status
        END,
        invoice_id = COALESCE(EXCLUDED.invoice_id, public.transactions.invoice_id),
        document_url = COALESCE(EXCLUDED.document_url, public.transactions.document_url),
        invoiced_at = CASE
          WHEN _mark_invoiced THEN COALESCE(public.transactions.invoiced_at, EXCLUDED.invoiced_at, now())
          ELSE public.transactions.invoiced_at
        END,
        updated_at = now()
  RETURNING id INTO _txn_id;

  RETURN _txn_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_transaction_for_pr(uuid, uuid, text, numeric, text, uuid, boolean, text) FROM anon, authenticated, public;

-- 3) Ensure transaction exists at PR creation, before timeline insert trigger fires.
CREATE OR REPLACE FUNCTION public.tg_pr_ensure_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _txn_id uuid;
BEGIN
  _txn_id := public.ensure_transaction_for_pr(NEW.id, NULL, NULL, NEW.total_amount, NEW.document_url, NULL, false, 'REQUEST_CREATED');
  UPDATE public.attachments SET transaction_id = _txn_id WHERE pr_id = NEW.id AND transaction_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_pr_ensure_transaction ON public.purchase_requisitions;
CREATE TRIGGER trg_00_pr_ensure_transaction
  AFTER INSERT ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.tg_pr_ensure_transaction();

REVOKE EXECUTE ON FUNCTION public.tg_pr_ensure_transaction() FROM anon, authenticated, public;

-- 4) Finance approval advances the existing transaction.
CREATE OR REPLACE FUNCTION public.tg_create_transaction_on_finance_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _txn_id uuid;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status::text = 'FINANCE_APPROVED' AND OLD.status::text IS DISTINCT FROM 'FINANCE_APPROVED')
     OR (TG_OP = 'INSERT' AND NEW.status::text = 'FINANCE_APPROVED') THEN
    _txn_id := public.ensure_transaction_for_pr(NEW.id, NULL, NULL, NEW.total_amount, NEW.document_url, NULL, false, 'FINANCE_APPROVED');

    UPDATE public.quote_requests SET transaction_id = _txn_id WHERE pr_id = NEW.id AND transaction_id IS NULL;
    UPDATE public.quotes SET transaction_id = _txn_id WHERE pr_id = NEW.id AND transaction_id IS NULL;
    UPDATE public.invoices SET transaction_id = _txn_id WHERE pr_id = NEW.id AND transaction_id IS NULL;
    UPDATE public.attachments SET transaction_id = _txn_id WHERE pr_id = NEW.id AND transaction_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Quote request/submission/acceptance advance the transaction, never create siblings.
CREATE OR REPLACE FUNCTION public.tg_quote_request_attach_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.transaction_id IS NULL THEN
    NEW.transaction_id := public.ensure_transaction_for_pr(NEW.pr_id, NEW.supplier_id, NULL, NULL, NULL, NULL, false, 'SUPPLIER_QUOTE');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_quote_attach_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supplier_name text;
BEGIN
  SELECT company_name INTO _supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;
  IF NEW.transaction_id IS NULL THEN
    NEW.transaction_id := public.ensure_transaction_for_pr(NEW.pr_id, NEW.supplier_id, _supplier_name, NEW.amount, NEW.document_url, NULL, false, 'SUPPLIER_QUOTE');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_quote_and_reject_others(_quote_id uuid, _pr_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  SELECT q.*, s.company_name
    INTO _quote_record
  FROM public.quotes q
  LEFT JOIN public.suppliers s ON s.id = q.supplier_id
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

  _supplier_name := _quote_record.company_name;
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
$$;

GRANT EXECUTE ON FUNCTION public.accept_quote_and_reject_others(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_quote_and_reject_others(uuid, uuid) FROM anon, public;

-- 6) Invoice insert/approval advances existing transaction.
CREATE OR REPLACE FUNCTION public.tg_invoice_attach_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _quote_amount numeric;
  _supplier_name text;
BEGIN
  SELECT q.amount, s.company_name
    INTO _quote_amount, _supplier_name
  FROM public.quotes q
  LEFT JOIN public.suppliers s ON s.id = q.supplier_id
  WHERE q.id = NEW.quote_id;

  NEW.transaction_id := COALESCE(
    NEW.transaction_id,
    public.ensure_transaction_for_pr(NEW.pr_id, NEW.supplier_id, _supplier_name, _quote_amount, NEW.document_url, NEW.id, true, 'SUPPLIER_INVOICE')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_invoice_fold_into_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _quote_amount numeric;
  _supplier_name text;
  _txn_id uuid;
  _next_status text;
BEGIN
  SELECT q.amount, s.company_name
    INTO _quote_amount, _supplier_name
  FROM public.quotes q
  LEFT JOIN public.suppliers s ON s.id = q.supplier_id
  WHERE q.id = NEW.quote_id;

  _next_status := CASE
    WHEN NEW.status = 'AWAITING_PAYMENT' THEN 'AWAITING_PAYMENT'
    WHEN NEW.status = 'PAID' THEN 'PAID'
    ELSE 'SUPPLIER_INVOICE'
  END;

  _txn_id := public.ensure_transaction_for_pr(
    NEW.pr_id,
    NEW.supplier_id,
    _supplier_name,
    _quote_amount,
    NEW.document_url,
    NEW.id,
    true,
    _next_status
  );

  UPDATE public.invoices
    SET transaction_id = _txn_id
    WHERE id = NEW.id AND transaction_id IS DISTINCT FROM _txn_id;

  UPDATE public.quotes
    SET transaction_id = _txn_id
    WHERE id = NEW.quote_id AND transaction_id IS DISTINCT FROM _txn_id;

  UPDATE public.attachments
    SET transaction_id = _txn_id
    WHERE pr_id = NEW.pr_id AND kind = 'INVOICE'::public.attachment_kind AND transaction_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_fold_into_transaction_status ON public.invoices;
CREATE TRIGGER trg_invoice_fold_into_transaction_status
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_fold_into_transaction();

-- 7) Batch lifecycle advances transaction status at creation and payment.
CREATE OR REPLACE FUNCTION public.create_payment_batch_draft(_allocations jsonb, _notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch_id uuid;
  _batch_number text;
  _alloc jsonb;
  _invoice_id uuid;
  _reimb_id uuid;
  _txn_id uuid;
  _amount numeric;
  _target_amount numeric;
  _already_paid numeric;
  _inv_status text;
  _r_status text;
  _r_amount numeric;
  _t_amount numeric;
  _t_status text;
  _total_batch numeric := 0;
  _seq int;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can create payment batches');
  END IF;
  _org_id := get_user_organization(_user_id);
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;
  IF jsonb_typeof(_allocations) <> 'array' OR jsonb_array_length(_allocations) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No allocations provided');
  END IF;

  SELECT COALESCE(MAX(CAST(SPLIT_PART(batch_number, '-', 3) AS int)), 0) + 1 INTO _seq
  FROM public.payment_batches
  WHERE organization_id = _org_id
    AND batch_number LIKE 'PB-' || to_char(now(), 'YYYYMMDD') || '-%';
  _batch_number := 'PB-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');

  INSERT INTO public.payment_batches (organization_id, created_by, total_amount, notes, status, batch_number)
  VALUES (_org_id, _user_id, 0, _notes, 'DRAFT', _batch_number)
  RETURNING id INTO _batch_id;

  FOR _alloc IN SELECT * FROM jsonb_array_elements(_allocations)
  LOOP
    _invoice_id := NULLIF(_alloc->>'invoice_id','')::uuid;
    _reimb_id := NULLIF(_alloc->>'reimbursement_id','')::uuid;
    _txn_id := NULLIF(_alloc->>'transaction_id','')::uuid;
    _amount := (_alloc->>'amount')::numeric;
    IF _amount IS NULL OR _amount <= 0 THEN CONTINUE; END IF;

    IF _invoice_id IS NOT NULL THEN
      SELECT i.status, COALESCE(i.transaction_id, t.id), COALESCE(q.amount, t.amount)
        INTO _inv_status, _txn_id, _target_amount
      FROM public.invoices i
      JOIN public.quotes q ON q.id = i.quote_id
      LEFT JOIN public.transactions t ON t.pr_id = i.pr_id
      WHERE i.id = _invoice_id AND i.organization_id = _org_id;

      IF _target_amount IS NULL OR _txn_id IS NULL THEN
        RAISE EXCEPTION 'Invoice % is not linked to a transaction in your organization', _invoice_id;
      END IF;
      IF _inv_status = 'PAID' THEN
        RAISE EXCEPTION 'Invoice is already paid and cannot be batched again';
      END IF;
      IF EXISTS (SELECT 1 FROM public.payment_allocations WHERE transaction_id = _txn_id) THEN
        RAISE EXCEPTION 'Transaction is already linked to a payment batch';
      END IF;

      SELECT COALESCE(SUM(pa.amount_paid),0) INTO _already_paid
      FROM public.payment_allocations pa
      JOIN public.payment_batches pb ON pb.id = pa.batch_id
      WHERE pa.transaction_id = _txn_id AND pb.status IN ('CONFIRMED','PAID','DRAFT');

      IF _already_paid + _amount > _target_amount THEN
        RAISE EXCEPTION 'Allocation for transaction % exceeds remaining balance', _txn_id;
      END IF;

      INSERT INTO public.payment_allocations (batch_id, invoice_id, transaction_id, organization_id, amount_paid, created_by)
      VALUES (_batch_id, _invoice_id, _txn_id, _org_id, _amount, _user_id);

      INSERT INTO public.payment_audit_log (organization_id, invoice_id, transaction_id, batch_id, action, amount, performed_by, notes)
      VALUES (_org_id, _invoice_id, _txn_id, _batch_id, 'DRAFT_ALLOCATION', _amount, _user_id, _batch_number);

      UPDATE public.transactions
      SET status = CASE WHEN status IN ('PAID','COMPLETED','FULLY_PAID') THEN status ELSE 'PAYMENT_BATCH' END,
          updated_at = now()
      WHERE id = _txn_id;

      UPDATE public.quotes q
      SET status = 'COMPLETED', updated_at = now(), transaction_id = _txn_id
      FROM public.invoices i
      WHERE i.id = _invoice_id AND q.id = i.quote_id AND q.status IN ('ACCEPTED','INVOICE_UPLOADED');

      UPDATE public.purchase_requisitions pr
      SET status = 'FULFILLED', updated_at = now()
      FROM public.invoices i
      WHERE i.id = _invoice_id AND pr.id = i.pr_id
        AND pr.status NOT IN ('CLOSED');

    ELSIF _reimb_id IS NOT NULL THEN
      SELECT status::text, amount INTO _r_status, _r_amount
      FROM public.reimbursements
      WHERE id = _reimb_id AND organization_id = _org_id;
      IF _r_status IS NULL THEN
        RAISE EXCEPTION 'Reimbursement % not found in your organization', _reimb_id;
      END IF;
      IF _r_status NOT IN ('AWAITING_PAYMENT','APPROVED') THEN
        RAISE EXCEPTION 'Reimbursement % is not approved/awaiting payment', _reimb_id;
      END IF;
      IF _amount > _r_amount THEN
        RAISE EXCEPTION 'Allocation for reimbursement % exceeds amount', _reimb_id;
      END IF;

      INSERT INTO public.payment_allocations (batch_id, reimbursement_id, organization_id, amount_paid, created_by)
      VALUES (_batch_id, _reimb_id, _org_id, _amount, _user_id);

      INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, performed_by, notes)
      VALUES (_org_id, _reimb_id, 'DRAFT_ALLOCATION', _user_id, _batch_number);

    ELSIF _txn_id IS NOT NULL THEN
      SELECT amount, status INTO _t_amount, _t_status
      FROM public.transactions
      WHERE id = _txn_id AND organization_id = _org_id
      FOR UPDATE;
      IF _t_amount IS NULL THEN
        RAISE EXCEPTION 'Transaction % not found in your organization', _txn_id;
      END IF;
      IF _t_status IN ('PAID','COMPLETED','FULLY_PAID') THEN
        RAISE EXCEPTION 'Transaction % is already paid', _txn_id;
      END IF;
      IF EXISTS (SELECT 1 FROM public.payment_allocations WHERE transaction_id = _txn_id) THEN
        RAISE EXCEPTION 'Transaction is already linked to a payment batch';
      END IF;

      SELECT COALESCE(SUM(pa.amount_paid),0) INTO _already_paid
      FROM public.payment_allocations pa
      JOIN public.payment_batches pb ON pb.id = pa.batch_id
      WHERE pa.transaction_id = _txn_id AND pb.status IN ('CONFIRMED','PAID','DRAFT');

      IF _already_paid + _amount > _t_amount THEN
        RAISE EXCEPTION 'Allocation for transaction % exceeds remaining balance', _txn_id;
      END IF;

      INSERT INTO public.payment_allocations (batch_id, transaction_id, organization_id, amount_paid, created_by)
      VALUES (_batch_id, _txn_id, _org_id, _amount, _user_id);

      INSERT INTO public.payment_audit_log (organization_id, transaction_id, batch_id, action, amount, performed_by, notes)
      VALUES (_org_id, _txn_id, _batch_id, 'DRAFT_ALLOCATION', _amount, _user_id, _batch_number);

      UPDATE public.transactions
      SET status = CASE WHEN status IN ('PAID','COMPLETED','FULLY_PAID') THEN status ELSE 'PAYMENT_BATCH' END,
          updated_at = now()
      WHERE id = _txn_id;
    ELSE
      CONTINUE;
    END IF;

    _total_batch := _total_batch + _amount;
  END LOOP;

  UPDATE public.payment_batches SET total_amount = _total_batch WHERE id = _batch_id;
  RETURN jsonb_build_object('success', true, 'batch_id', _batch_id, 'batch_number', _batch_number, 'total', _total_batch);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_batch_draft(jsonb, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_payment_batch_draft(jsonb, text) FROM anon, public;

CREATE OR REPLACE FUNCTION public.confirm_batch_paid(_batch_id uuid, _payment_reference text DEFAULT NULL::text, _payment_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch record;
  _alloc record;
  _paid_total numeric;
  _old_status text;
  _new_status text;
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
  SET status = 'PAID', confirmed_at = now(), paid_at = now(), payment_reference = _payment_reference
  WHERE id = _batch_id;

  FOR _alloc IN
    SELECT pa.id, pa.invoice_id, COALESCE(pa.transaction_id, i.transaction_id, t.id) AS transaction_id,
           pa.amount_paid, i.status AS inv_status, i.quote_id, i.pr_id, COALESCE(q.amount, t.amount) AS target_amount
    FROM public.payment_allocations pa
    JOIN public.invoices i ON i.id = pa.invoice_id
    JOIN public.quotes q ON q.id = i.quote_id
    LEFT JOIN public.transactions t ON t.pr_id = i.pr_id
    WHERE pa.batch_id = _batch_id AND pa.invoice_id IS NOT NULL
  LOOP
    UPDATE public.payment_allocations
    SET payment_date = COALESCE(_payment_date, CURRENT_DATE),
        payment_reference = _payment_reference,
        transaction_id = _alloc.transaction_id
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
    VALUES (_org_id, _alloc.invoice_id, _alloc.transaction_id, _batch_id, 'BATCH_CONFIRMED', _old_status, _new_status, _alloc.amount_paid, _user_id, _payment_reference);

    IF _new_status = 'PAID' THEN
      UPDATE public.quotes SET status = 'COMPLETED', transaction_id = _alloc.transaction_id, updated_at = now()
      WHERE id = _alloc.quote_id AND status <> 'COMPLETED';

      UPDATE public.purchase_requisitions SET status = 'CLOSED', updated_at = now()
      WHERE id = _alloc.pr_id AND status <> 'CLOSED';
    END IF;
  END LOOP;

  FOR _alloc IN
    SELECT pa.id, pa.reimbursement_id, pa.amount_paid, r.status::text AS r_status, r.employee_id, r.currency, r.amount AS r_amount
    FROM public.payment_allocations pa
    JOIN public.reimbursements r ON r.id = pa.reimbursement_id
    WHERE pa.batch_id = _batch_id AND pa.reimbursement_id IS NOT NULL
  LOOP
    UPDATE public.payment_allocations
    SET payment_date = COALESCE(_payment_date, CURRENT_DATE), payment_reference = _payment_reference
    WHERE id = _alloc.id;

    UPDATE public.reimbursements
    SET status = 'PAID', paid_at = now(), updated_at = now(),
        reimbursement_reference = COALESCE(_payment_reference, reimbursement_reference),
        reimbursement_date = COALESCE(_payment_date, CURRENT_DATE)
    WHERE id = _alloc.reimbursement_id;

    INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
    VALUES (_org_id, _alloc.reimbursement_id, 'BATCH_PAID', _alloc.r_status, 'PAID', _user_id, _payment_reference);

    PERFORM public._notify_users(ARRAY[_alloc.employee_id], _org_id,
      'full_payment', 'Reimbursement paid',
      'Your reimbursement of ' || _alloc.currency || ' ' || _alloc.r_amount || ' has been paid in batch ' || _batch.batch_number || '.',
      _alloc.reimbursement_id::text);
  END LOOP;

  FOR _alloc IN
    SELECT pa.id, pa.transaction_id, pa.amount_paid, t.amount AS target_amount, t.status AS txn_status
    FROM public.payment_allocations pa
    JOIN public.transactions t ON t.id = pa.transaction_id
    WHERE pa.batch_id = _batch_id AND pa.transaction_id IS NOT NULL AND pa.invoice_id IS NULL
  LOOP
    UPDATE public.payment_allocations
    SET payment_date = COALESCE(_payment_date, CURRENT_DATE), payment_reference = _payment_reference
    WHERE id = _alloc.id;

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
    VALUES (_org_id, _alloc.transaction_id, _batch_id, 'BATCH_CONFIRMED', _alloc.txn_status, _new_status, _alloc.amount_paid, _user_id, _payment_reference);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_batch_paid(uuid, text, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_batch_paid(uuid, text, date) FROM anon, public;

-- 8) Timeline titles for normalized statuses.
CREATE OR REPLACE FUNCTION public.tg_te_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'FINANCE_APPROVED' THEN _title := 'Approved by Finance'; _type := 'FINANCE_APPROVED';
    ELSIF NEW.status = 'SUPPLIER_QUOTE' THEN _title := 'Quote Uploaded'; _type := 'QUOTE_UPLOADED';
    ELSIF NEW.status = 'QUOTE_ACCEPTED' THEN _title := 'Quote Accepted'; _type := 'QUOTE_ACCEPTED';
    ELSIF NEW.status IN ('SUPPLIER_INVOICE','INVOICED') THEN _title := 'Invoice Uploaded'; _type := 'INVOICE_UPLOADED';
    ELSIF NEW.status = 'AWAITING_PAYMENT' THEN _title := 'Invoice Approved'; _type := 'INVOICE_APPROVED';
    ELSIF NEW.status = 'PAYMENT_BATCH' THEN _title := 'Payment Batch Created'; _type := 'BATCH_CREATED';
    ELSIF NEW.status IN ('PAID','FULLY_PAID') THEN _title := 'Payment Completed'; _type := 'PAYMENT_COMPLETED';
    ELSIF NEW.status = 'COMPLETED' THEN _title := 'Completed'; _type := 'COMPLETED';
    ELSIF NEW.status = 'PARTIALLY_PAID' THEN _title := 'Partial Payment'; _type := 'TXN_PARTIAL';
    ELSE _title := 'Transaction Updated'; _type := 'TXN_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.pr_id, NEW.id, NEW.organization_id, _type, _title, NULL, NEW.status, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_te_transaction() FROM anon, authenticated, public;