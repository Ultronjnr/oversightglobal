-- Fix: Supplier Contact Information Available to Competitors
-- The 'suppliers' table SELECT policies don't explicitly deny unauthenticated access
-- We need to ensure ALL SELECT policies require authentication

-- First, drop existing SELECT policies on suppliers
DROP POLICY IF EXISTS "Suppliers can view their own data" ON public.suppliers;
DROP POLICY IF EXISTS "Finance and Admin can view verified suppliers" ON public.suppliers;

-- Recreate policies with explicit auth.uid() IS NOT NULL check
-- Suppliers can view their own data (requires authentication)
CREATE POLICY "Suppliers can view their own data"
ON public.suppliers
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- Finance and Admin can view verified suppliers (requires authentication)
CREATE POLICY "Finance and Admin can view verified suppliers"
ON public.suppliers
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_verified = true 
  AND (
    has_role(auth.uid(), 'FINANCE'::app_role) 
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  )
);