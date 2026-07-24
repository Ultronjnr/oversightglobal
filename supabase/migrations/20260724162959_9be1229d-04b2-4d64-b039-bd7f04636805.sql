
-- 1. Fix invoice status CHECK (root cause of "invoices_status_check" batch error)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY['UPLOADED','AWAITING_PAYMENT','PARTIALLY_PAID','PAID']));

-- 2. Project + Donor linkage columns (nullable so existing rows keep working)
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.donation_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS donor_id   uuid REFERENCES public.donation_org_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pr_locked  boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.donation_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS donor_id   uuid REFERENCES public.donation_org_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_document_path   text,
  ADD COLUMN IF NOT EXISTS scan_document_bucket text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.donation_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS donor_id   uuid REFERENCES public.donation_org_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_document_path   text,
  ADD COLUMN IF NOT EXISTS scan_document_bucket text;

ALTER TABLE public.ocr_analyses
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.donation_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS donor_id   uuid REFERENCES public.donation_org_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- 3. Duplicate-prevention constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_pr_id_unique'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_pr_id_unique UNIQUE (pr_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_quote_id_unique_idx
  ON public.invoices (quote_id) WHERE quote_id IS NOT NULL;

-- 4. Auto-lock PR when a transaction or invoice is created against it
CREATE OR REPLACE FUNCTION public.lock_pr_on_txn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pr_id IS NOT NULL THEN
    UPDATE public.purchase_requisitions SET pr_locked = true WHERE id = NEW.pr_id AND pr_locked = false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lock_pr_on_txn ON public.transactions;
CREATE TRIGGER trg_lock_pr_on_txn AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.lock_pr_on_txn();

DROP TRIGGER IF EXISTS trg_lock_pr_on_invoice ON public.invoices;
CREATE TRIGGER trg_lock_pr_on_invoice AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.lock_pr_on_txn();

-- 5. Atomic project-budget allocation with hard block
CREATE OR REPLACE FUNCTION public.allocate_project_funds(
  _project_id uuid,
  _donor_id   uuid,
  _amount     numeric,
  _source_type text DEFAULT 'PR',
  _source_id   uuid DEFAULT NULL,
  _description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id  uuid;
  _project record;
  _spent   numeric;
  _remaining numeric;
  _alloc_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  _org_id := get_user_organization(_user_id);

  SELECT * INTO _project FROM public.donation_projects
    WHERE id = _project_id AND organization_id = _org_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _spent
    FROM public.fund_allocations
   WHERE project_id = _project_id AND organization_id = _org_id;

  _remaining := COALESCE(_project.budget, 0) - _spent;

  IF _amount > _remaining THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient project funds. Remaining: %s, Requested: %s', _remaining, _amount),
      'remaining', _remaining,
      'requested', _amount
    );
  END IF;

  INSERT INTO public.fund_allocations (
    organization_id, donor_id, project_id, amount,
    allocation_type, source_type, source_id, description, created_by, allocation_date
  ) VALUES (
    _org_id, _donor_id, _project_id, _amount,
    'DEBIT'::allocation_type_enum,
    COALESCE(_source_type, 'PR')::allocation_source_enum,
    _source_id, _description, _user_id, CURRENT_DATE
  ) RETURNING id INTO _alloc_id;

  RETURN jsonb_build_object(
    'success', true,
    'allocation_id', _alloc_id,
    'remaining_after', _remaining - _amount
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

REVOKE ALL ON FUNCTION public.allocate_project_funds(uuid, uuid, numeric, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_project_funds(uuid, uuid, numeric, text, uuid, text) TO authenticated;
