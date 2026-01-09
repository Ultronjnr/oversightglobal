-- Allow authenticated users to insert organizations (needed for company signup)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow the inserting user to read the org they just created (for getting the ID back)
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = get_user_organization(auth.uid()) 
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  )
);