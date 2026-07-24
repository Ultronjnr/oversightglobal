CREATE OR REPLACE FUNCTION public.allocate_project_funds(
  _project_id uuid,
  _donor_id uuid,
  _amount numeric,
  _source_type text DEFAULT 'PR',
  _source_id uuid DEFAULT NULL,
  _description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.allocate_project_funds(uuid, uuid, numeric, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.allocate_project_funds(uuid, uuid, numeric, text, uuid, text) TO authenticated, service_role;