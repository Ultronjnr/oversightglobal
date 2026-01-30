
-- Create a SECURITY DEFINER function to check if organization has an active HOD
-- This bypasses RLS so any authenticated user can check HOD existence for routing
CREATE OR REPLACE FUNCTION public.organization_has_active_hod(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'HOD'
    AND p.organization_id = _org_id
    AND p.status = 'ACTIVE'
  )
$$;
