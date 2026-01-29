-- Add RLS policy for Admins to view linked suppliers
CREATE POLICY "Admin can view linked org suppliers"
ON public.suppliers
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND is_verified = true 
  AND has_role(auth.uid(), 'ADMIN'::app_role) 
  AND EXISTS (
    SELECT 1 FROM organization_suppliers os
    WHERE os.supplier_id = suppliers.id
    AND os.organization_id = get_user_organization(auth.uid())
    AND os.status = 'ACCEPTED'::org_supplier_status
  )
);