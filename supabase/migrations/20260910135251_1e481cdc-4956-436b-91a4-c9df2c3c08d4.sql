CREATE OR REPLACE FUNCTION public.organization_staffing(_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_users', count(*) FILTER (WHERE ur.role IS DISTINCT FROM 'SUPPLIER'),
    'has_admin',    bool_or(ur.role = 'ADMIN'),
    'has_finance',  bool_or(ur.role = 'FINANCE'),
    'has_hod',      bool_or(ur.role = 'HOD'),
    'has_employee', bool_or(ur.role = 'EMPLOYEE')
  )
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.organization_id = _org_id
    AND p.status = 'ACTIVE';
$$;

GRANT EXECUTE ON FUNCTION public.organization_staffing(uuid) TO authenticated;