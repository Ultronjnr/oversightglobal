
-- Payment batches table
CREATE TABLE public.payment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view org batches"
  ON public.payment_batches FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

CREATE POLICY "Finance can create org batches"
  ON public.payment_batches FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'FINANCE'::app_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "Admin can view org batches"
  ON public.payment_batches FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

-- Payment allocations: each row = one invoice paid (partially or fully) within a batch
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.payment_batches(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  amount_paid NUMERIC NOT NULL CHECK (amount_paid >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_allocations_invoice ON public.payment_allocations(invoice_id);
CREATE INDEX idx_payment_allocations_batch ON public.payment_allocations(batch_id);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view org allocations"
  ON public.payment_allocations FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

CREATE POLICY "Finance can create org allocations"
  ON public.payment_allocations FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

CREATE POLICY "Admin can view org allocations"
  ON public.payment_allocations FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

-- RPC to atomically create a batch with allocations and update invoice statuses
CREATE OR REPLACE FUNCTION public.create_payment_batch(
  _allocations jsonb,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch_id uuid;
  _alloc jsonb;
  _invoice_id uuid;
  _amount numeric;
  _quote_amount numeric;
  _already_paid numeric;
  _new_total numeric;
  _total_batch numeric := 0;
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

  -- Create batch
  INSERT INTO public.payment_batches (organization_id, created_by, total_amount, notes)
  VALUES (_org_id, _user_id, 0, _notes)
  RETURNING id INTO _batch_id;

  -- Process each allocation
  FOR _alloc IN SELECT * FROM jsonb_array_elements(_allocations)
  LOOP
    _invoice_id := (_alloc->>'invoice_id')::uuid;
    _amount := (_alloc->>'amount')::numeric;

    IF _amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Get invoice + quote amount, verify org match
    SELECT q.amount INTO _quote_amount
    FROM public.invoices i
    JOIN public.quotes q ON q.id = i.quote_id
    WHERE i.id = _invoice_id AND i.organization_id = _org_id;

    IF _quote_amount IS NULL THEN
      RAISE EXCEPTION 'Invoice % not found or not in your organization', _invoice_id;
    END IF;

    -- Sum prior payments
    SELECT COALESCE(SUM(amount_paid), 0) INTO _already_paid
    FROM public.payment_allocations
    WHERE invoice_id = _invoice_id;

    _new_total := _already_paid + _amount;

    IF _new_total > _quote_amount THEN
      RAISE EXCEPTION 'Allocation for invoice % exceeds remaining balance', _invoice_id;
    END IF;

    -- Insert allocation
    INSERT INTO public.payment_allocations (batch_id, invoice_id, organization_id, amount_paid)
    VALUES (_batch_id, _invoice_id, _org_id, _amount);

    -- Update invoice status
    IF _new_total >= _quote_amount THEN
      UPDATE public.invoices SET status = 'PAID', updated_at = now() WHERE id = _invoice_id;
    ELSE
      UPDATE public.invoices SET status = 'PARTIALLY_PAID', updated_at = now() WHERE id = _invoice_id;
    END IF;

    _total_batch := _total_batch + _amount;
  END LOOP;

  -- Update batch total
  UPDATE public.payment_batches SET total_amount = _total_batch WHERE id = _batch_id;

  RETURN jsonb_build_object('success', true, 'batch_id', _batch_id, 'total', _total_batch);
END;
$$;
