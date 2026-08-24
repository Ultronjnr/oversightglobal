-- 1. Restrict donor PII + project budget visibility to ADMIN / FINANCE / HOD
DROP POLICY IF EXISTS "Internal staff can view org donors" ON public.organization_donors;
CREATE POLICY "Managers and HODs can view org donors"
ON public.organization_donors
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (
    public.is_donation_manager(auth.uid())
    OR public.has_role(auth.uid(), 'HOD'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Internal staff can view org projects" ON public.donation_projects;
CREATE POLICY "Managers and HODs can view org projects"
ON public.donation_projects
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (
    public.is_donation_manager(auth.uid())
    OR public.has_role(auth.uid(), 'HOD'::public.app_role)
  )
);

-- 2. Require donation-manager role inside allocate_project_funds
CREATE OR REPLACE FUNCTION public.allocate_project_funds(_project_id uuid, _donor_id uuid, _amount numeric, _source_type text DEFAULT 'PR'::text, _source_id uuid DEFAULT NULL::uuid, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT public.is_donation_manager(_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
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
    'RESERVED'::public.allocation_type,
    COALESCE(_source_type, 'PR')::public.allocation_source,
    _source_id, _description, _user_id, CURRENT_DATE
  ) RETURNING id INTO _alloc_id;

  RETURN jsonb_build_object(
    'success', true,
    'allocation_id', _alloc_id,
    'remaining_after', _remaining - _amount
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END
$function$;