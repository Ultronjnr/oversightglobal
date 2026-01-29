-- Update Finance policy on suppliers table to only see ACCEPTED suppliers for their organization
DROP POLICY IF EXISTS "Finance and Admin can view verified suppliers" ON public.suppliers;

-- Admin can view all verified suppliers (for acceptance workflow)
CREATE POLICY "Admin can view verified suppliers"
ON public.suppliers
FOR SELECT
USING (
    auth.uid() IS NOT NULL
    AND is_verified = true
    AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Finance can only view suppliers ACCEPTED for their organization
CREATE POLICY "Finance can view accepted org suppliers"
ON public.suppliers
FOR SELECT
USING (
    auth.uid() IS NOT NULL
    AND is_verified = true
    AND has_role(auth.uid(), 'FINANCE'::app_role)
    AND EXISTS (
        SELECT 1 FROM public.organization_suppliers os
        WHERE os.supplier_id = suppliers.id
        AND os.organization_id = get_user_organization(auth.uid())
        AND os.status = 'ACCEPTED'
    )
);