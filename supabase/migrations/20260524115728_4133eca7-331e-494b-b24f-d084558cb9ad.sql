
-- 1. Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL UNIQUE REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'APPROVED_NOT_PAID'
    CHECK (status IN ('APPROVED_NOT_PAID','PARTIALLY_PAID','FULLY_PAID')),
  approved_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_org_status ON public.transactions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_pr ON public.transactions(pr_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view org transactions"
  ON public.transactions FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

CREATE POLICY "Admin can view org transactions"
  ON public.transactions FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Employees can view own transactions"
  ON public.transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = transactions.pr_id AND pr.requested_by = auth.uid()
  ));

CREATE POLICY "Finance can update org transactions"
  ON public.transactions FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Trigger: create transaction when PR becomes FINANCE_APPROVED
CREATE OR REPLACE FUNCTION public.tg_create_transaction_on_finance_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supplier_id uuid;
  _supplier_name text;
  _items jsonb;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status::text = 'FINANCE_APPROVED' AND OLD.status::text IS DISTINCT FROM 'FINANCE_APPROVED')
     OR (TG_OP = 'INSERT' AND NEW.status::text = 'FINANCE_APPROVED') THEN

    -- Try to derive supplier from accepted quote
    SELECT q.supplier_id, s.company_name
      INTO _supplier_id, _supplier_name
    FROM public.quotes q
    LEFT JOIN public.suppliers s ON s.id = q.supplier_id
    WHERE q.pr_id = NEW.id AND q.status = 'ACCEPTED'
    LIMIT 1;

    -- Fallback: look at PR items for supplier_preference (manual name)
    IF _supplier_name IS NULL THEN
      _items := NEW.items;
      IF jsonb_typeof(_items) = 'array' AND jsonb_array_length(_items) > 0 THEN
        _supplier_name := NULLIF(trim(COALESCE(_items->0->>'supplier_preference','')), '');
      END IF;
    END IF;

    INSERT INTO public.transactions (
      pr_id, organization_id, supplier_id, supplier_name,
      amount, currency, status, approved_at
    ) VALUES (
      NEW.id, NEW.organization_id, _supplier_id, _supplier_name,
      NEW.total_amount, NEW.currency, 'APPROVED_NOT_PAID', now()
    )
    ON CONFLICT (pr_id) DO UPDATE
      SET amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          supplier_id = COALESCE(public.transactions.supplier_id, EXCLUDED.supplier_id),
          supplier_name = COALESCE(public.transactions.supplier_name, EXCLUDED.supplier_name),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_finance_approved_transaction ON public.purchase_requisitions;
CREATE TRIGGER trg_pr_finance_approved_transaction
AFTER INSERT OR UPDATE OF status ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_create_transaction_on_finance_approval();

-- 3. Backfill existing FINANCE_APPROVED PRs
INSERT INTO public.transactions (pr_id, organization_id, supplier_id, supplier_name, amount, currency, status, approved_at)
SELECT
  pr.id,
  pr.organization_id,
  (SELECT q.supplier_id FROM public.quotes q WHERE q.pr_id = pr.id AND q.status = 'ACCEPTED' LIMIT 1),
  COALESCE(
    (SELECT s.company_name FROM public.quotes q JOIN public.suppliers s ON s.id = q.supplier_id WHERE q.pr_id = pr.id AND q.status = 'ACCEPTED' LIMIT 1),
    NULLIF(trim(COALESCE(pr.items->0->>'supplier_preference','')), '')
  ),
  pr.total_amount,
  pr.currency,
  'APPROVED_NOT_PAID',
  pr.updated_at
FROM public.purchase_requisitions pr
WHERE pr.status::text = 'FINANCE_APPROVED'
ON CONFLICT (pr_id) DO NOTHING;

-- 4. Add transaction_id to payment_allocations
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_allocations_transaction ON public.payment_allocations(transaction_id);

-- 5. Update create_payment_batch_draft to support transactions
CREATE OR REPLACE FUNCTION public.create_payment_batch_draft(_allocations jsonb, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _quote_amount numeric;
  _already_paid numeric;
  _r_status text;
  _r_amount numeric;
  _t_amount numeric;
  _t_paid numeric;
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

    ELSIF _txn_id IS NOT NULL THEN
      SELECT amount, amount_paid, status INTO _t_amount, _t_paid, _t_status
      FROM public.transactions WHERE id = _txn_id AND organization_id = _org_id;
      IF _t_amount IS NULL THEN
        RAISE EXCEPTION 'Transaction % not found in your organization', _txn_id;
      END IF;
      IF _t_status = 'FULLY_PAID' THEN
        RAISE EXCEPTION 'Transaction % is already fully paid', _txn_id;
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
    ELSE
      CONTINUE;
    END IF;

    _total_batch := _total_batch + _amount;
  END LOOP;

  UPDATE public.payment_batches SET total_amount = _total_batch WHERE id = _batch_id;
  RETURN jsonb_build_object('success', true, 'batch_id', _batch_id, 'batch_number', _batch_number, 'total', _total_batch);
END;
$function$;

-- 6. Update confirm_batch_paid to handle transactions
CREATE OR REPLACE FUNCTION public.confirm_batch_paid(_batch_id uuid, _payment_reference text DEFAULT NULL::text, _payment_date date DEFAULT NULL::date)
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

  -- Transaction allocations
  FOR _alloc IN
    SELECT pa.id, pa.transaction_id, pa.amount_paid, t.amount AS t_amount, t.status AS t_status
    FROM public.payment_allocations pa
    JOIN public.transactions t ON t.id = pa.transaction_id
    WHERE pa.batch_id = _batch_id AND pa.transaction_id IS NOT NULL
  LOOP
    UPDATE public.payment_allocations
    SET payment_date = COALESCE(_payment_date, CURRENT_DATE), payment_reference = _payment_reference
    WHERE id = _alloc.id;

    SELECT COALESCE(SUM(pa.amount_paid),0) INTO _paid_total
    FROM public.payment_allocations pa
    JOIN public.payment_batches pb ON pb.id = pa.batch_id
    WHERE pa.transaction_id = _alloc.transaction_id AND pb.status IN ('CONFIRMED','PAID');

    IF _paid_total >= _alloc.t_amount THEN _new_status := 'FULLY_PAID'; ELSE _new_status := 'PARTIALLY_PAID'; END IF;

    UPDATE public.transactions
    SET amount_paid = _paid_total,
        status = _new_status,
        paid_at = CASE WHEN _new_status = 'FULLY_PAID' THEN now() ELSE paid_at END,
        updated_at = now()
    WHERE id = _alloc.transaction_id;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 7. Update update_batch_draft to support transactions
CREATE OR REPLACE FUNCTION public.update_batch_draft(_batch_id uuid, _add jsonb DEFAULT '[]'::jsonb, _remove uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch record;
  _alloc jsonb;
  _invoice_id uuid;
  _txn_id uuid;
  _reimb_id uuid;
  _amount numeric;
  _quote_amount numeric;
  _already_paid numeric;
  _t_amount numeric;
  _t_status text;
  _r_status text;
  _r_amount numeric;
  _total numeric;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can modify payment batches');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _batch FROM public.payment_batches WHERE id = _batch_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batch not found');
  END IF;
  IF _batch.status <> 'DRAFT' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only draft batches can be modified');
  END IF;

  IF _remove IS NOT NULL AND array_length(_remove, 1) > 0 THEN
    DELETE FROM public.payment_allocations WHERE id = ANY(_remove) AND batch_id = _batch_id;
  END IF;

  IF jsonb_typeof(_add) = 'array' THEN
    FOR _alloc IN SELECT * FROM jsonb_array_elements(_add)
    LOOP
      _invoice_id := NULLIF(_alloc->>'invoice_id','')::uuid;
      _reimb_id := NULLIF(_alloc->>'reimbursement_id','')::uuid;
      _txn_id := NULLIF(_alloc->>'transaction_id','')::uuid;
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

      ELSIF _reimb_id IS NOT NULL THEN
        SELECT status::text, amount INTO _r_status, _r_amount FROM public.reimbursements
        WHERE id = _reimb_id AND organization_id = _org_id;
        IF _r_status IS NULL THEN
          RAISE EXCEPTION 'Reimbursement % not found in your organization', _reimb_id;
        END IF;
        IF _amount > _r_amount THEN
          RAISE EXCEPTION 'Allocation for reimbursement % exceeds amount', _reimb_id;
        END IF;
        INSERT INTO public.payment_allocations (batch_id, reimbursement_id, organization_id, amount_paid, created_by)
        VALUES (_batch_id, _reimb_id, _org_id, _amount, _user_id);

      ELSIF _txn_id IS NOT NULL THEN
        SELECT amount, status INTO _t_amount, _t_status
        FROM public.transactions WHERE id = _txn_id AND organization_id = _org_id;
        IF _t_amount IS NULL THEN
          RAISE EXCEPTION 'Transaction % not found in your organization', _txn_id;
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
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(amount_paid),0) INTO _total FROM public.payment_allocations WHERE batch_id = _batch_id;
  UPDATE public.payment_batches SET total_amount = _total WHERE id = _batch_id;

  RETURN jsonb_build_object('success', true, 'total', _total);
END;
$function$;
