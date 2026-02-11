
-- Drop overly permissive "Authenticated users only" policies
-- These allow ANY authenticated user to read ALL records across ALL organizations

DROP POLICY "Authenticated users only" ON public.profiles;
DROP POLICY "Authenticated users only" ON public.suppliers;
DROP POLICY "Authenticated users only" ON public.organizations;
DROP POLICY "Authenticated users only" ON public.purchase_requisitions;
