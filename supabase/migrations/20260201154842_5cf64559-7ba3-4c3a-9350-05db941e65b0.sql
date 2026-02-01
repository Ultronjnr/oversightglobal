-- Add contact_person column to suppliers table
ALTER TABLE public.suppliers
ADD COLUMN contact_person text;

-- Update the accept_supplier_invitation function to include contact_person
CREATE OR REPLACE FUNCTION public.accept_supplier_invitation(
  _token text, 
  _email text, 
  _user_id uuid, 
  _company_name text, 
  _industries text[], 
  _vat_number text DEFAULT NULL, 
  _registration_number text DEFAULT NULL, 
  _phone text DEFAULT NULL, 
  _address text DEFAULT NULL,
  _contact_person text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Validate required fields
  IF _company_name IS NULL OR trim(_company_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company name is required');
  END IF;
  
  IF _industries IS NULL OR array_length(_industries, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one industry is required');
  END IF;
  
  IF _registration_number IS NULL OR trim(_registration_number) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration number is required');
  END IF;
  
  IF _address IS NULL OR trim(_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Address is required');
  END IF;
  
  IF _phone IS NULL OR trim(_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact phone is required');
  END IF;
  
  IF _contact_person IS NULL OR trim(_contact_person) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact person name is required');
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
    is_verified,
    contact_person
  ) VALUES (
    _user_id,
    trim(_company_name),
    LOWER(_email),
    trim(_phone),
    trim(_address),
    trim(_registration_number),
    _industries[1], -- Primary industry
    NULLIF(trim(_vat_number), ''),
    _invitation.organization_id,
    _invitation.invited_by,
    false,
    true -- Auto-verified since invited by admin
  , trim(_contact_person)
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