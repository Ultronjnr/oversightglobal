-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Admin can view linked org suppliers" ON public.suppliers;

-- Create a security definer function to check if a supplier is linked to an organization
-- This avoids recursive RLS checks
CREATE OR REPLACE FUNCTION public.is_supplier_linked_to_org(_supplier_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_suppliers
    WHERE supplier_id = _supplier_id
    AND organization_id = _org_id
    AND status = 'ACCEPTED'::org_supplier_status
  )
$$;