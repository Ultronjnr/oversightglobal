-- Helper: caller has any internal (non-supplier) staff role
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ADMIN','FINANCE','HOD','EMPLOYEE')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_internal_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_internal_staff(uuid) TO authenticated, service_role;

-- Departments: only internal staff of the org may view
DROP POLICY IF EXISTS "Org members can view departments" ON public.departments;
CREATE POLICY "Internal staff can view departments"
ON public.departments
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.is_internal_staff(auth.uid())
);

-- Profiles: users see their own row; otherwise must be internal staff of same org
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization(auth.uid())
    AND public.is_internal_staff(auth.uid())
  )
);