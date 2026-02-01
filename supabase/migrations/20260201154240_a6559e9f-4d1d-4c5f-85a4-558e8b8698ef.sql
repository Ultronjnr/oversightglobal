-- =====================================================
-- SUPPLIER INVITATION-ONLY ONBOARDING MIGRATION
-- Removes public supplier signup, adds org-bound suppliers
-- =====================================================

-- 1. Add new columns to suppliers table for organization binding
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS invited_by_admin_id uuid,
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_number text;

-- 2. Create index for organization lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON public.suppliers(organization_id);

-- 3. Drop ALL existing RLS policies on suppliers table
DROP POLICY IF EXISTS "Admin can view verified suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Finance can view accepted org suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers can update their own data" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers can view their own data" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert their own supplier profile" ON public.suppliers;

-- 4. Create new organization-scoped RLS policies for suppliers

-- Admins can view suppliers in their organization
CREATE POLICY "Admins can view org suppliers"
ON public.suppliers
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND has_role(auth.uid(), 'ADMIN')
);

-- Finance can view suppliers in their organization
CREATE POLICY "Finance can view org suppliers"
ON public.suppliers
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND has_role(auth.uid(), 'FINANCE')
);

-- Suppliers can view their own record
CREATE POLICY "Suppliers can view own record"
ON public.suppliers
FOR SELECT
USING (user_id = auth.uid());

-- Suppliers can update their own record
CREATE POLICY "Suppliers can update own record"
ON public.suppliers
FOR UPDATE
USING (user_id = auth.uid());

-- Only system (via security definer functions) can insert suppliers
-- No direct insert policy - handled by create_supplier_invitation function

-- 5. Create function to generate supplier invitation
CREATE OR REPLACE FUNCTION public.create_supplier_invitation(
  _email text,
  _company_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
  _org_id uuid;
  _token text;
  _expires_at timestamptz;
  _invitation_id uuid;
BEGIN
  -- Get admin's ID and organization
  _admin_id := auth.uid();
  
  -- Verify caller is an admin
  IF NOT has_role(_admin_id, 'ADMIN') THEN
    RAISE EXCEPTION 'Only admins can invite suppliers';
  END IF;
  
  -- Get organization ID
  SELECT organization_id INTO _org_id
  FROM public.profiles
  WHERE id = _admin_id;
  
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Admin must belong to an organization';
  END IF;
  
  -- Check if supplier invitation already exists for this email in this org
  IF EXISTS (
    SELECT 1 FROM public.invitations 
    WHERE LOWER(email) = LOWER(_email) 
    AND organization_id = _org_id 
    AND role = 'SUPPLIER'
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A pending invitation already exists for this email';
  END IF;
  
  -- Generate secure token
  _token := encode(gen_random_bytes(32), 'hex');
  _expires_at := now() + interval '7 days';
  
  -- Create invitation record
  INSERT INTO public.invitations (
    email,
    role,
    department,
    token,
    status,
    expires_at,
    organization_id,
    invited_by
  ) VALUES (
    LOWER(_email),
    'SUPPLIER',
    _company_name, -- Store company name in department field temporarily
    _token,
    'pending',
    _expires_at,
    _org_id,
    _admin_id
  )
  RETURNING id INTO _invitation_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', _invitation_id,
    'token', _token,
    'email', LOWER(_email),
    'organization_id', _org_id
  );
END;
$$;

-- 6. Create function to accept supplier invitation and create supplier record
CREATE OR REPLACE FUNCTION public.accept_supplier_invitation(
  _token text,
  _email text,
  _user_id uuid,
  _company_name text,
  _industries text[],
  _vat_number text DEFAULT NULL,
  _registration_number text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation record;
  _supplier_id uuid;
BEGIN
  -- Get and validate invitation
  SELECT * INTO _invitation
  FROM public.invitations
  WHERE token = _token 
  AND LOWER(email) = LOWER(_email)
  AND role = 'SUPPLIER'
  AND status = 'pending'
  AND expires_at > now()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Create supplier record
  INSERT INTO public.suppliers (
    user_id,
    company_name,
    contact_email,
    phone,
    address,
    registration_number,
    industry,
    vat_number,
    organization_id,
    invited_by_admin_id,
    is_public,
    is_verified
  ) VALUES (
    _user_id,
    _company_name,
    LOWER(_email),
    _phone,
    _address,
    _registration_number,
    _industries[1], -- Primary industry
    _vat_number,
    _invitation.organization_id,
    _invitation.invited_by,
    false,
    true -- Auto-verified since invited by admin
  )
  RETURNING id INTO _supplier_id;
  
  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = _invitation.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'supplier_id', _supplier_id,
    'organization_id', _invitation.organization_id
  );
END;
$$;

-- 7. Update quote_requests RLS to use new supplier organization field
DROP POLICY IF EXISTS "Suppliers can view their quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Suppliers can update their quote requests" ON public.quote_requests;

CREATE POLICY "Suppliers can view their quote requests"
ON public.quote_requests
FOR SELECT
USING (
  supplier_id IN (
    SELECT id FROM public.suppliers 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Suppliers can update their quote requests"
ON public.quote_requests
FOR UPDATE
USING (
  supplier_id IN (
    SELECT id FROM public.suppliers 
    WHERE user_id = auth.uid()
  )
);

-- 8. Update quotes RLS for supplier access
DROP POLICY IF EXISTS "Suppliers can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Suppliers can create quotes for their requests" ON public.quotes;

CREATE POLICY "Suppliers can view their own quotes"
ON public.quotes
FOR SELECT
USING (
  supplier_id IN (
    SELECT id FROM public.suppliers 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Suppliers can create quotes for their requests"
ON public.quotes
FOR INSERT
WITH CHECK (
  supplier_id IN (
    SELECT id FROM public.suppliers 
    WHERE user_id = auth.uid()
  )
);

-- 9. Drop the organization_suppliers junction table (no longer needed)
DROP TABLE IF EXISTS public.organization_suppliers CASCADE;