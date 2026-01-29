-- Fix infinite recursion on suppliers SELECT by removing cross-table RLS evaluation
-- 1) Replace the Finance suppliers SELECT policy to use SECURITY DEFINER helper function
DROP POLICY IF EXISTS "Finance can view accepted org suppliers" ON public.suppliers;

CREATE POLICY "Finance can view accepted org suppliers"
ON public.suppliers
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_verified = true
  AND has_role(auth.uid(), 'FINANCE'::app_role)
  AND public.is_supplier_linked_to_org(suppliers.id, get_user_organization(auth.uid()))
);

-- 2) Allow Admins to create org-supplier relationships (Accept/Decline uses UPSERT)
DROP POLICY IF EXISTS "Admins can create org supplier relationships" ON public.organization_suppliers;

CREATE POLICY "Admins can create org supplier relationships"
ON public.organization_suppliers
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN'::app_role)
);
