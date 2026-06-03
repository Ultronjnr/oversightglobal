CREATE OR REPLACE FUNCTION public.validate_supplier_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv record;
BEGIN
  SELECT id, email, company_name, contact_person, industry, registration_number,
         vat_number, organization_id, status, expires_at
  INTO _inv
  FROM public.supplier_invitations
  WHERE token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;

  IF _inv.status = 'ACCEPTED' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has already been used', 'reason', 'accepted');
  END IF;

  IF _inv.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has been cancelled', 'reason', 'cancelled');
  END IF;

  IF _inv.expires_at < now() THEN
    UPDATE public.supplier_invitations SET status = 'EXPIRED' WHERE id = _inv.id AND status <> 'EXPIRED';
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation has expired', 'reason', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', _inv.id,
    'email', _inv.email,
    'company_name', _inv.company_name,
    'contact_person', _inv.contact_person,
    'industry', _inv.industry,
    'registration_number', _inv.registration_number,
    'vat_number', _inv.vat_number,
    'organization_id', _inv.organization_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_supplier_invitation(uuid) TO anon, authenticated;