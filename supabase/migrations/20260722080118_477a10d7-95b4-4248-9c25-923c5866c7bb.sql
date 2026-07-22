
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND organization_id IS NOT DISTINCT FROM (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  AND tier IS NOT DISTINCT FROM (SELECT p.tier FROM public.profiles p WHERE p.id = auth.uid())
);
