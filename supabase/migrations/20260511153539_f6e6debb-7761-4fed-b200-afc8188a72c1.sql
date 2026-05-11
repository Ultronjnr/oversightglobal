-- =========================================================
-- SUITE 1: Linked Employee Reimbursement System
-- All changes are additive. No existing logic is altered.
-- =========================================================

-- 1. Purchase Requisition: optional reimbursement flag
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS requires_reimbursement boolean NOT NULL DEFAULT false;

-- 2. Reimbursements: link to PR + payment details + awaiting status
ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS pr_id uuid,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reimbursement_reference text,
  ADD COLUMN IF NOT EXISTS reimbursement_date date;

-- Extend status enum (reimbursement_status) with AWAITING_PAYMENT if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'reimbursement_status' AND e.enumlabel = 'AWAITING_PAYMENT'
  ) THEN
    ALTER TYPE public.reimbursement_status ADD VALUE 'AWAITING_PAYMENT';
  END IF;
END$$;

-- 3. payment_allocations: support reimbursement-based allocations
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS reimbursement_id uuid;

-- Make invoice_id nullable so an allocation can target either invoice OR reimbursement
ALTER TABLE public.payment_allocations
  ALTER COLUMN invoice_id DROP NOT NULL;

-- Ensure at least one target is set
ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_target_check;
ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_target_check
  CHECK (invoice_id IS NOT NULL OR reimbursement_id IS NOT NULL);

-- 4. Reimbursement audit log
CREATE TABLE IF NOT EXISTS public.reimbursement_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  reimbursement_id uuid NOT NULL,
  action text NOT NULL,
  old_status text,
  new_status text,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.reimbursement_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance can view org reimbursement audit log" ON public.reimbursement_audit_log;
CREATE POLICY "Finance can view org reimbursement audit log"
ON public.reimbursement_audit_log
FOR SELECT TO authenticated
USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

DROP POLICY IF EXISTS "Admin can view org reimbursement audit log" ON public.reimbursement_audit_log;
CREATE POLICY "Admin can view org reimbursement audit log"
ON public.reimbursement_audit_log
FOR SELECT TO authenticated
USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

-- 5. RPC: submit reimbursement linked to a PR
CREATE OR REPLACE FUNCTION public.submit_reimbursement_for_pr(
  _pr_id uuid,
  _amount numeric,
  _description text,
  _payment_method text,
  _reference text DEFAULT NULL,
  _reimbursement_date date DEFAULT NULL,
  _proof_url text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _pr record;
  _reimb_id uuid;
  _employee_name text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _pr FROM public.purchase_requisitions WHERE id = _pr_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Requisition not found');
  END IF;

  IF _pr.requested_by <> _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the requisition owner can submit a reimbursement for it');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF _amount > _pr.total_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement amount cannot exceed requisition total');
  END IF;

  IF _proof_url IS NULL OR trim(_proof_url) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proof of payment is required');
  END IF;

  SELECT COALESCE(name || ' ' || COALESCE(surname,''), email) INTO _employee_name
  FROM public.profiles WHERE id = _user_id;

  INSERT INTO public.reimbursements (
    organization_id, employee_id, employee_name, amount, description,
    proof_document_url, paid_by_employee, status, pr_id, payment_method,
    reimbursement_reference, reimbursement_date, notes
  ) VALUES (
    _pr.organization_id, _user_id, COALESCE(_employee_name,'Employee'), _amount, _description,
    _proof_url, true, 'PENDING', _pr_id, _payment_method,
    _reference, _reimbursement_date, _notes
  ) RETURNING id INTO _reimb_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, new_status, performed_by, notes)
  VALUES (_pr.organization_id, _reimb_id, 'SUBMITTED', 'PENDING', _user_id, _notes);

  RETURN jsonb_build_object('success', true, 'reimbursement_id', _reimb_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_reimbursement_for_pr(uuid,numeric,text,text,text,date,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_reimbursement_for_pr(uuid,numeric,text,text,text,date,text,text) TO authenticated;

-- 6. RPC: approve reimbursement
CREATE OR REPLACE FUNCTION public.approve_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL)
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
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can approve reimbursements');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement is not pending');
  END IF;

  UPDATE public.reimbursements
  SET status = 'AWAITING_PAYMENT', approved_by = _user_id, approved_at = now(), updated_at = now()
  WHERE id = _reimbursement_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'APPROVED', 'PENDING', 'AWAITING_PAYMENT', _user_id, _notes);

  -- Notify employee
  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'reimbursement_approved', 'Reimbursement approved',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' is awaiting payment.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_reimbursement(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_reimbursement(uuid,text) TO authenticated;

-- 7. RPC: reject reimbursement
CREATE OR REPLACE FUNCTION public.reject_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL)
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
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can reject reimbursements');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text NOT IN ('PENDING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement is not pending');
  END IF;

  UPDATE public.reimbursements
  SET status = 'REJECTED', approved_by = _user_id, approved_at = now(), updated_at = now(), notes = COALESCE(_notes, notes)
  WHERE id = _reimbursement_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'REJECTED', 'PENDING', 'REJECTED', _user_id, _notes);

  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'reimbursement_approved', 'Reimbursement rejected',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' was rejected.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_reimbursement(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reject_reimbursement(uuid,text) TO authenticated;

-- 8. RPC: mark single reimbursement as paid (direct payment, outside batch)
CREATE OR REPLACE FUNCTION public.mark_reimbursement_paid(
  _reimbursement_id uuid,
  _payment_reference text DEFAULT NULL,
  _payment_date date DEFAULT NULL
)
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
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can mark reimbursements as paid');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text NOT IN ('AWAITING_PAYMENT','APPROVED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement is not awaiting payment');
  END IF;

  UPDATE public.reimbursements
  SET status = 'PAID', paid_at = now(), updated_at = now(),
      reimbursement_reference = COALESCE(_payment_reference, reimbursement_reference),
      reimbursement_date = COALESCE(_payment_date, reimbursement_date, CURRENT_DATE)
  WHERE id = _reimbursement_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'PAID', _r.status::text, 'PAID', _user_id, _payment_reference);

  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'full_payment', 'Reimbursement paid',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' has been paid.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_reimbursement_paid(uuid,text,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_reimbursement_paid(uuid,text,date) TO authenticated;

-- 9. Extend confirm_batch_paid to also flip reimbursement allocations to PAID
CREATE OR REPLACE FUNCTION public.confirm_batch_paid(_batch_id uuid, _payment_reference text DEFAULT NULL, _payment_date date DEFAULT NULL)
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

  -- Invoice allocations
  FOR _alloc IN
    SELECT pa.id, pa.invoice_id, pa.amount_paid, i.status AS inv_status, q.amount AS quote_amount
    FROM public.payment_allocations pa
    JOIN public.invoices i ON i.id = pa.invoice_id
    JOIN public.quotes q ON q.id = i.quote_id
    WHERE pa.batch_id = _batch_id AND pa.invoice_id IS NOT NULL
  LOOP
    UPDATE public.payment_allocations
    SET payment_date = COALESCE(_payment_date, CURRENT_DATE), payment_reference = _payment_reference
    WHERE id = _alloc.id;

    SELECT COALESCE(SUM(pa.amount_paid),0) INTO _paid_total
    FROM public.payment_allocations pa
    JOIN public.payment_batches pb ON pb.id = pa.batch_id
    WHERE pa.invoice_id = _alloc.invoice_id AND pb.status IN ('CONFIRMED','PAID');

    _old_status := _alloc.inv_status;
    IF _paid_total >= _alloc.quote_amount THEN _new_status := 'PAID'; ELSE _new_status := 'PARTIALLY_PAID'; END IF;
    UPDATE public.invoices SET status = _new_status, updated_at = now() WHERE id = _alloc.invoice_id;

    INSERT INTO public.payment_audit_log (organization_id, invoice_id, batch_id, action, old_status, new_status, amount, performed_by, notes)
    VALUES (_org_id, _alloc.invoice_id, _batch_id, 'BATCH_CONFIRMED', _old_status, _new_status, _alloc.amount_paid, _user_id, _payment_reference);
  END LOOP;

  -- Reimbursement allocations
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

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_batch_paid(uuid,text,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.confirm_batch_paid(uuid,text,date) TO authenticated;

-- 10. Extend create_payment_batch_draft to accept reimbursement allocations
CREATE OR REPLACE FUNCTION public.create_payment_batch_draft(_allocations jsonb, _notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch_id uuid;
  _batch_number text;
  _alloc jsonb;
  _invoice_id uuid;
  _reimb_id uuid;
  _amount numeric;
  _quote_amount numeric;
  _already_paid numeric;
  _r_status text;
  _r_amount numeric;
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
    _amount := (_alloc->>'amount')::numeric;
    IF _amount IS NULL OR _amount <= 0 THEN CONTINUE; END IF;

    IF _invoice_id IS NOT NULL THEN
      SELECT q.amount INTO _quote_amount
      FROM public.invoices i JOIN public.quotes q ON q.id = i.quote_id
      WHERE i.id = _invoice_id AND i.organization_id = _org_id;
      IF _quote_amount IS NULL THEN
        RAISE EXCEPTION 'Invoice % not found in your organization', _invoice_id;
      END IF;

      SELECT COALESCE(SUM(pa.amount_paid),0) INTO _already_paid
      FROM public.payment_allocations pa
      JOIN public.payment_batches pb ON pb.id = pa.batch_id
      WHERE pa.invoice_id = _invoice_id AND pb.status IN ('CONFIRMED','PAID');

      IF _already_paid + _amount > _quote_amount THEN
        RAISE EXCEPTION 'Allocation for invoice % exceeds remaining balance', _invoice_id;
      END IF;

      INSERT INTO public.payment_allocations (batch_id, invoice_id, organization_id, amount_paid, created_by)
      VALUES (_batch_id, _invoice_id, _org_id, _amount, _user_id);

      INSERT INTO public.payment_audit_log (organization_id, invoice_id, batch_id, action, amount, performed_by, notes)
      VALUES (_org_id, _invoice_id, _batch_id, 'DRAFT_ALLOCATION', _amount, _user_id, _batch_number);

    ELSIF _reimb_id IS NOT NULL THEN
      SELECT status::text, amount INTO _r_status, _r_amount FROM public.reimbursements
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
    ELSE
      CONTINUE;
    END IF;

    _total_batch := _total_batch + _amount;
  END LOOP;

  UPDATE public.payment_batches SET total_amount = _total_batch WHERE id = _batch_id;
  RETURN jsonb_build_object('success', true, 'batch_id', _batch_id, 'batch_number', _batch_number, 'total', _total_batch);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_payment_batch_draft(jsonb,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_payment_batch_draft(jsonb,text) TO authenticated;