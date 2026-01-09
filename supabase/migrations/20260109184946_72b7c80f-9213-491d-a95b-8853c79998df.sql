-- 1. Allow authenticated users to create organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Update SELECT policy to allow viewing during signup
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = public.get_user_organization(auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  )
);