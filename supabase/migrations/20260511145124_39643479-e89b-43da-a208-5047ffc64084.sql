
-- 1. Extend payment_batches
ALTER TABLE public.payment_batches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Backfill batch_number for existing batches and mark them PAID (legacy behavior was immediate paid).
UPDATE public.payment_batches
SET batch_number = 'PB-' || to_char(created_at, 'YYYYMMDD') || '-' || substr(id::text, 1, 4),
    status = 'PAID',
    paid_at = COALESCE(paid_at, created_at),
    confirmed_at = COALESCE(confirmed_at, created_at)
WHERE batch_number IS NULL;

ALTER TABLE public.payment_batches
  ALTER COLUMN batch_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_batches_batch_number_uidx
  ON public.payment_batches (batch_number);

-- 2. Extend payment_allocations
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 3. Payment audit log
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invoice_id uuid,
  batch_id uuid,
  action text NOT NULL,
  old_status text,
  new_status text,
  amount numeric,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS payment_audit_log_org_idx ON public.payment_audit_log (organization_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS payment_audit_log_invoice_idx ON public.payment_audit_log (invoice_id);
CREATE INDEX IF NOT EXISTS payment_audit_log_batch_idx ON public.payment_audit_log (batch_id);

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance can view org payment audit log" ON public.payment_audit_log;
CREATE POLICY "Finance can view org payment audit log"
  ON public.payment_audit_log
  FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

DROP POLICY IF EXISTS "Admin can view org payment audit log" ON public.payment_audit_log;
CREATE POLICY "Admin can view org payment audit log"
  ON public.payment_audit_log
  FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

-- 4. RPC: create draft batch (no invoice status changes yet)
CREATE OR REPLACE FUNCTION public.create_payment_batch_draft(_allocations jsonb, _notes text DEFAULT NULL)
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
  _amount numeric;
  _quote_amount numeric;
  _already_paid numeric;
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

  -- Generate batch number
  SELECT COALESCE(MAX(CAST(SPLIT_PART(batch_number, '-', 3) AS int)), 0) + 1
    INTO _seq
  FROM public.payment_batches
  WHERE organization_id = _org_id
    AND batch_number LIKE 'PB-' || to_char(now(), 'YYYYMMDD') || '-%';
  _batch_number := 'PB-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');

  INSERT INTO public.payment_batches (organization_id, created_by, total_amount, notes, status, batch_number)
  VALUES (_org_id, _user_id, 0, _notes, 'DRAFT', _batch_number)
  RETURNING id INTO _batch_id;

  FOR _alloc IN SELECT * FROM jsonb_array_elements(_allocations)
  LOOP
    _invoice_id := (_alloc->>'invoice_id')::uuid;
    _amount := (_alloc->>'amount')::numeric;

    IF _amount IS NULL OR _amount <= 0 THEN
      CONTINUE;
    END IF;

    SELECT q.amount INTO _quote_amount
    FROM public.invoices i
    JOIN public.quotes q ON q.id = i.quote_id
    WHERE i.id = _invoice_id AND i.organization_id = _org_id;

    IF _quote_amount IS NULL THEN
      RAISE EXCEPTION 'Invoice % not found or not in your organization', _invoice_id;
    END IF;

    -- Already paid only counts confirmed/paid allocations (drafts excluded).
    SELECT COALESCE(SUM(pa.amount_paid), 0) INTO _already_paid
    FROM public.payment_allocations pa
    JOIN public.payment_batches pb ON pb.id = pa.batch_id
    WHERE pa.invoice_id = _invoice_id
      AND pb.status IN ('CONFIRMED', 'PAID');

    IF _already_paid + _amount > _quote_amount THEN
      RAISE EXCEPTION 'Allocation for invoice % exceeds remaining balance', _invoice_id;
    END IF;

    INSERT INTO public.payment_allocations (batch_id, invoice_id, organization_id, amount_paid, created_by)
    VALUES (_batch_id, _invoice_id, _org_id, _amount, _user_id);

    INSERT INTO public.payment_audit_log (organization_id, invoice_id, batch_id, action, amount, performed_by, notes)
    VALUES (_org_id, _invoice_id, _batch_id, 'DRAFT_ALLOCATION', _amount, _user_id, _batch_number);

    _total_batch := _total_batch + _amount;
  END LOOP;

  UPDATE public.payment_batches SET total_amount = _total_batch WHERE id = _batch_id;

  RETURN jsonb_build_object('success', true, 'batch_id', _batch_id, 'batch_number', _batch_number, 'total', _total_batch);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_payment_batch_draft(jsonb, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_payment_batch_draft(jsonb, text) TO authenticated;

-- 5. RPC: update draft batch (add/remove allocations)
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
  _amount numeric;
  _quote_amount numeric;
  _already_paid numeric;
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

  -- Remove allocations
  IF _remove IS NOT NULL AND array_length(_remove, 1) > 0 THEN
    INSERT INTO public.payment_audit_log (organization_id, invoice_id, batch_id, action, amount, performed_by, notes)
    SELECT _org_id, pa.invoice_id, _batch_id, 'DRAFT_REMOVE', pa.amount_paid, _user_id, _batch.batch_number
    FROM public.payment_allocations pa
    WHERE pa.id = ANY(_remove) AND pa.batch_id = _batch_id;

    DELETE FROM public.payment_allocations WHERE id = ANY(_remove) AND batch_id = _batch_id;
  END IF;

  -- Add allocations
  IF jsonb_typeof(_add) = 'array' THEN
    FOR _alloc IN SELECT * FROM jsonb_array_elements(_add)
    LOOP
      _invoice_id := (_alloc->>'invoice_id')::uuid;
      _amount := (_alloc->>'amount')::numeric;
      IF _amount IS NULL OR _amount <= 0 THEN CONTINUE; END IF;

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
      VALUES (_org_id, _invoice_id, _batch_id, 'DRAFT_ADD', _amount, _user_id, _batch.batch_number);
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(amount_paid),0) INTO _total FROM public.payment_allocations WHERE batch_id = _batch_id;
  UPDATE public.payment_batches SET total_amount = _total WHERE id = _batch_id;

  RETURN jsonb_build_object('success', true, 'total', _total);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_batch_draft(uuid, jsonb, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_batch_draft(uuid, jsonb, uuid[]) TO authenticated;

-- 6. RPC: confirm batch paid -> updates invoices + audit + notification
CREATE OR REPLACE FUNCTION public.confirm_batch_paid(_batch_id uuid, _payment_reference text DEFAULT NULL, _payment_date date DEFAULT NULL)
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
  _quote_amount numeric;
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

  -- Mark batch confirmed/paid
  UPDATE public.payment_batches
  SET status = 'PAID',
      confirmed_at = now(),
      paid_at = now(),
      payment_reference = _payment_reference
  WHERE id = _batch_id;

  -- Update invoices and write audit
  FOR _alloc IN
    SELECT pa.id, pa.invoice_id, pa.amount_paid, i.status AS inv_status, q.amount AS quote_amount
    FROM public.payment_allocations pa
    JOIN public.invoices i ON i.id = pa.invoice_id
    JOIN public.quotes q ON q.id = i.quote_id
    WHERE pa.batch_id = _batch_id
  LOOP
    UPDATE public.payment_allocations
    SET payment_date = COALESCE(_payment_date, CURRENT_DATE),
        payment_reference = _payment_reference
    WHERE id = _alloc.id;

    SELECT COALESCE(SUM(pa.amount_paid),0) INTO _paid_total
    FROM public.payment_allocations pa
    JOIN public.payment_batches pb ON pb.id = pa.batch_id
    WHERE pa.invoice_id = _alloc.invoice_id AND pb.status IN ('CONFIRMED','PAID');

    _old_status := _alloc.inv_status;
    IF _paid_total >= _alloc.quote_amount THEN
      _new_status := 'PAID';
    ELSE
      _new_status := 'PARTIALLY_PAID';
    END IF;

    UPDATE public.invoices SET status = _new_status, updated_at = now() WHERE id = _alloc.invoice_id;

    INSERT INTO public.payment_audit_log (organization_id, invoice_id, batch_id, action, old_status, new_status, amount, performed_by, notes)
    VALUES (_org_id, _alloc.invoice_id, _batch_id, 'BATCH_CONFIRMED', _old_status, _new_status, _alloc.amount_paid, _user_id, _payment_reference);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_batch_paid(uuid, text, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.confirm_batch_paid(uuid, text, date) TO authenticated;

-- 7. RPC: cancel draft batch
CREATE OR REPLACE FUNCTION public.cancel_batch_draft(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch record;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can cancel payment batches');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _batch FROM public.payment_batches WHERE id = _batch_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Batch not found'); END IF;
  IF _batch.status <> 'DRAFT' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only draft batches can be cancelled');
  END IF;

  INSERT INTO public.payment_audit_log (organization_id, batch_id, action, old_status, new_status, amount, performed_by, notes)
  VALUES (_org_id, _batch_id, 'BATCH_CANCELLED', 'DRAFT', 'CANCELLED', _batch.total_amount, _user_id, _batch.batch_number);

  DELETE FROM public.payment_allocations WHERE batch_id = _batch_id;
  UPDATE public.payment_batches SET status = 'CANCELLED', total_amount = 0 WHERE id = _batch_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_batch_draft(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cancel_batch_draft(uuid) TO authenticated;

-- 8. RPC: recompute overdue (>30 days awaiting payment)
CREATE OR REPLACE FUNCTION public.recompute_overdue_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _count integer := 0;
  _rec record;
BEGIN
  IF NOT (has_role(_user_id, 'FINANCE'::app_role) OR has_role(_user_id, 'ADMIN'::app_role)) THEN
    RETURN 0;
  END IF;
  _org_id := get_user_organization(_user_id);

  FOR _rec IN
    SELECT i.id, i.status
    FROM public.invoices i
    WHERE i.organization_id = _org_id
      AND i.status IN ('AWAITING_PAYMENT','UPLOADED')
      AND i.created_at < now() - interval '30 days'
  LOOP
    UPDATE public.invoices SET status = 'OVERDUE', updated_at = now() WHERE id = _rec.id;
    INSERT INTO public.payment_audit_log (organization_id, invoice_id, action, old_status, new_status, performed_by, notes)
    VALUES (_org_id, _rec.id, 'AUTO_OVERDUE', _rec.status, 'OVERDUE', _user_id, '30+ days unpaid');
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$function$;

REVOKE ALL ON FUNCTION public.recompute_overdue_invoices() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.recompute_overdue_invoices() TO authenticated;
