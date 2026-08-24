-- 1. Guard: only FINANCE/ADMIN may set or change project/donor on a requisition
CREATE OR REPLACE FUNCTION public.tg_pr_funding_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _changed := (NEW.project_id IS NOT NULL OR NEW.donor_id IS NOT NULL);
  ELSE
    _changed := (NEW.project_id IS DISTINCT FROM OLD.project_id)
             OR (NEW.donor_id IS DISTINCT FROM OLD.donor_id);
  END IF;

  IF _changed AND _uid IS NOT NULL THEN
    IF NOT (public.has_role(_uid, 'FINANCE'::public.app_role)
         OR public.has_role(_uid, 'ADMIN'::public.app_role)) THEN
      RAISE EXCEPTION 'Only Finance or Admin can set the Project or Donor on a requisition';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_funding_guard ON public.purchase_requisitions;
CREATE TRIGGER trg_pr_funding_guard
BEFORE INSERT OR UPDATE OF project_id, donor_id ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_pr_funding_guard();

-- 2. Propagate PR funding source down to transactions + invoices
CREATE OR REPLACE FUNCTION public.tg_pr_funding_propagate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
     AND NEW.donor_id IS NOT DISTINCT FROM OLD.donor_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.transactions
     SET project_id = NEW.project_id,
         donor_id   = NEW.donor_id,
         updated_at = now()
   WHERE pr_id = NEW.id
     AND (project_id IS DISTINCT FROM NEW.project_id
       OR donor_id   IS DISTINCT FROM NEW.donor_id);

  UPDATE public.invoices
     SET project_id = NEW.project_id,
         donor_id   = NEW.donor_id,
         updated_at = now()
   WHERE pr_id = NEW.id
     AND (project_id IS DISTINCT FROM NEW.project_id
       OR donor_id   IS DISTINCT FROM NEW.donor_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_funding_propagate ON public.purchase_requisitions;
CREATE TRIGGER trg_pr_funding_propagate
AFTER INSERT OR UPDATE OF project_id, donor_id ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_pr_funding_propagate();

-- 3. Any newly created transaction / invoice inherits from its parent PR
CREATE OR REPLACE FUNCTION public.tg_inherit_funding_from_pr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pr record;
BEGIN
  IF NEW.pr_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.project_id IS NOT NULL AND NEW.donor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT project_id, donor_id INTO _pr
    FROM public.purchase_requisitions WHERE id = NEW.pr_id;

  IF FOUND THEN
    NEW.project_id := COALESCE(NEW.project_id, _pr.project_id);
    NEW.donor_id   := COALESCE(NEW.donor_id, _pr.donor_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_txn_inherit_funding ON public.transactions;
CREATE TRIGGER trg_txn_inherit_funding
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_inherit_funding_from_pr();

DROP TRIGGER IF EXISTS trg_invoice_inherit_funding ON public.invoices;
CREATE TRIGGER trg_invoice_inherit_funding
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_inherit_funding_from_pr();

-- 4. Reserved -> Spent when a transaction is fully paid
CREATE OR REPLACE FUNCTION public.tg_settle_project_funds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
    UPDATE public.fund_allocations
       SET allocation_type = 'SPENT'::public.allocation_type,
           updated_at = now()
     WHERE allocation_type = 'RESERVED'::public.allocation_type
       AND (
            (NEW.pr_id IS NOT NULL AND source_id = NEW.pr_id)
         OR source_id = NEW.id
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settle_project_funds ON public.transactions;
CREATE TRIGGER trg_settle_project_funds
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_settle_project_funds();

-- 5. Budget summary for the approval preview
CREATE OR REPLACE FUNCTION public.get_project_budget_summary(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org uuid;
  _budget numeric;
  _reserved numeric;
  _spent numeric;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  _org := public.get_user_organization(_uid);

  SELECT budget INTO _budget
    FROM public.donation_projects
   WHERE id = _project_id AND organization_id = _org;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE allocation_type = 'RESERVED'::public.allocation_type), 0),
    COALESCE(SUM(amount) FILTER (WHERE allocation_type = 'SPENT'::public.allocation_type), 0)
  INTO _reserved, _spent
  FROM public.fund_allocations
  WHERE project_id = _project_id AND organization_id = _org;

  RETURN jsonb_build_object(
    'success', true,
    'budget', COALESCE(_budget, 0),
    'reserved', _reserved,
    'spent', _spent,
    'remaining', COALESCE(_budget, 0) - _reserved - _spent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_budget_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_budget_summary(uuid) TO authenticated;

-- 6. Backfill existing history
UPDATE public.transactions t
   SET project_id = pr.project_id,
       donor_id   = COALESCE(t.donor_id, pr.donor_id)
  FROM public.purchase_requisitions pr
 WHERE t.pr_id = pr.id
   AND (pr.project_id IS NOT NULL OR pr.donor_id IS NOT NULL)
   AND (t.project_id IS NULL OR t.donor_id IS NULL);

UPDATE public.invoices i
   SET project_id = pr.project_id,
       donor_id   = COALESCE(i.donor_id, pr.donor_id)
  FROM public.purchase_requisitions pr
 WHERE i.pr_id = pr.id
   AND (pr.project_id IS NOT NULL OR pr.donor_id IS NOT NULL)
   AND (i.project_id IS NULL OR i.donor_id IS NULL);