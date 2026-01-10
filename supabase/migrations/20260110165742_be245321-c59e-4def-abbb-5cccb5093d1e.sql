-- Fix #1: Unrestricted Organization Creation (organization_creation, rls_permissive_insert)
-- Replace the overly permissive INSERT policy with one that enforces one-organization-per-user

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create a secure policy that only allows users without an existing organization to create one
CREATE POLICY "Users can create one organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND organization_id IS NOT NULL
  )
);

-- Fix #2: Add PR Items Validation (pr_items_validation)
-- Create a validation function for PR items JSONB

CREATE OR REPLACE FUNCTION public.validate_pr_items(items JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  desc_text TEXT;
  qty NUMERIC;
  price NUMERIC;
BEGIN
  -- Ensure items is an array
  IF jsonb_typeof(items) != 'array' THEN
    RAISE EXCEPTION 'Items must be an array';
  END IF;
  
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Check description length (max 500 characters)
    desc_text := item->>'description';
    IF desc_text IS NOT NULL AND length(desc_text) > 500 THEN
      RAISE EXCEPTION 'Item description too long (max 500 characters)';
    END IF;
    
    -- Check quantity is positive
    qty := (item->>'quantity')::numeric;
    IF qty IS NOT NULL AND qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be positive';
    END IF;
    
    -- Check unit price is non-negative
    price := (item->>'unit_price')::numeric;
    IF price IS NOT NULL AND price < 0 THEN
      RAISE EXCEPTION 'Item unit price cannot be negative';
    END IF;
  END LOOP;
  
  RETURN TRUE;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid numeric value in items';
END;
$$;

-- Add constraint to validate items on insert/update
ALTER TABLE public.purchase_requisitions
DROP CONSTRAINT IF EXISTS check_items_valid;

ALTER TABLE public.purchase_requisitions
ADD CONSTRAINT check_items_valid CHECK (validate_pr_items(items));

-- Add constraint to ensure total_amount is reasonable
ALTER TABLE public.purchase_requisitions
DROP CONSTRAINT IF EXISTS check_total_positive;

ALTER TABLE public.purchase_requisitions
ADD CONSTRAINT check_total_positive CHECK (total_amount >= 0 AND total_amount <= 999999999);