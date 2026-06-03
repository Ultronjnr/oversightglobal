-- Extend supplier_invitations with new fields
ALTER TABLE public.supplier_invitations
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_user_id uuid;

-- Audit log table for supplier invitations
CREATE TABLE IF NOT EXISTS public.supplier_invitation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.supplier_invitations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  action text NOT NULL,
  performed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplier_invitation_audit_log TO authenticated;
GRANT ALL ON public.supplier_invitation_audit_log TO service_role;

ALTER TABLE public.supplier_invitation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view supplier invitation audit log"
ON public.supplier_invitation_audit_log
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

-- ============ create_supplier_invite ============
CREATE OR REPLACE FUNCTION public.create_supplier_invite(
  _email text,
  _company_name text,
  _contact_person text,
  _industry text DEFAULT NULL,
  _registration_number text DEFAULT NULL,
  _vat_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _org_id uuid;
  _norm_email text := lower(trim(coalesce(_email, '')));
  _invitation_id uuid;
  _token uuid;
BEGIN
  IF NOT has_role(_admin_id, 'ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can invite suppliers');
  END IF;

  IF _norm_email = '' OR _norm_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid email address');
  END IF;

  IF coalesce(trim(_company_name), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company name is required');
  END IF;

  IF coalesce(trim(_contact_person), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact person is required');
  END IF;

  _org_id := get_user_organization(_admin_id);
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  -- Duplicate: existing supplier with this email in org
  IF EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE lower(contact_email) = _norm_email AND organization_id = _org_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Supplier already registered');
  END IF;

  -- Duplicate: pending invitation already exists
  IF EXISTS (
    SELECT 1 FROM public.supplier_invitations
    WHERE lower(email) = _norm_email AND organization_id = _org_id AND status = 'PENDING' AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending invitation already exists for this email');
  END IF;

  INSERT INTO public.supplier_invitations (
    organization_id, email, company_name, contact_person, industry,
    registration_number, vat_number, status, invited_by, expires_at
  ) VALUES (
    _org_id, _norm_email, trim(_company_name), trim(_contact_person), NULLIF(trim(_industry), ''),
    NULLIF(trim(_registration_number), ''), NULLIF(trim(_vat_number), ''), 'PENDING', _admin_id, now() + interval '7 days'
  )
  RETURNING id, token INTO _invitation_id, _token;

  INSERT INTO public.supplier_invitation_audit_log (invitation_id, organization_id, action, performed_by)
  VALUES (_invitation_id, _org_id, 'CREATED', _admin_id);

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', _invitation_id,
    'token', _token,
    'email', _norm_email,
    'company_name', trim(_company_name),
    'contact_person', trim(_contact_person)
  );
END;
$$;

-- ============ resend_supplier_invite ============
CREATE OR REPLACE FUNCTION public.resend_supplier_invite(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _org_id uuid;
  _inv record;
  _new_token uuid := gen_random_uuid();
BEGIN
  IF NOT has_role(_admin_id, 'ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can resend invitations');
  END IF;
  _org_id := get_user_organization(_admin_id);

  SELECT * INTO _inv FROM public.supplier_invitations
  WHERE id = _invitation_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  IF _inv.status = 'ACCEPTED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already accepted');
  END IF;

  UPDATE public.supplier_invitations
  SET token = _new_token, status = 'PENDING', expires_at = now() + interval '7 days'
  WHERE id = _invitation_id;

  INSERT INTO public.supplier_invitation_audit_log (invitation_id, organization_id, action, performed_by)
  VALUES (_invitation_id, _org_id, 'RESENT', _admin_id);

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', _invitation_id,
    'token', _new_token,
    'email', _inv.email,
    'company_name', _inv.company_name,
    'contact_person', _inv.contact_person
  );
END;
$$;

-- ============ cancel_supplier_invite ============
CREATE OR REPLACE FUNCTION public.cancel_supplier_invite(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _org_id uuid;
  _inv record;
BEGIN
  IF NOT has_role(_admin_id, 'ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can cancel invitations');
  END IF;
  _org_id := get_user_organization(_admin_id);

  SELECT * INTO _inv FROM public.supplier_invitations
  WHERE id = _invitation_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  IF _inv.status = 'ACCEPTED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already accepted');
  END IF;

  UPDATE public.supplier_invitations SET status = 'CANCELLED' WHERE id = _invitation_id;

  INSERT INTO public.supplier_invitation_audit_log (invitation_id, organization_id, action, performed_by)
  VALUES (_invitation_id, _org_id, 'CANCELLED', _admin_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ validate_supplier_invitation (token uuid) ============
CREATE OR REPLACE FUNCTION public.validate_supplier_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv record;
BEGIN
  SELECT id, email, company_name, contact_person, organization_id, status, expires_at
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
    -- mark expired
    UPDATE public.supplier_invitations SET status = 'EXPIRED' WHERE id = _inv.id AND status <> 'EXPIRED';
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation has expired', 'reason', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', _inv.id,
    'email', _inv.email,
    'company_name', _inv.company_name,
    'contact_person', _inv.contact_person,
    'organization_id', _inv.organization_id
  );
END;
$$;

-- ============ accept_supplier_invitation_token (mark accepted + audit) ============
CREATE OR REPLACE FUNCTION public.accept_supplier_invitation_token(_token uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv record;
BEGIN
  SELECT * INTO _inv FROM public.supplier_invitations
  WHERE token = _token AND status = 'PENDING' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.supplier_invitations
  SET status = 'ACCEPTED', accepted_at = now(), supplier_user_id = _user_id
  WHERE id = _inv.id;

  INSERT INTO public.supplier_invitation_audit_log (invitation_id, organization_id, action, performed_by)
  VALUES (_inv.id, _inv.organization_id, 'ACCEPTED', _user_id);

  RETURN true;
END;
$$;

-- Allow anonymous (pre-auth) validation on registration page
GRANT EXECUTE ON FUNCTION public.validate_supplier_invitation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_invite(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_supplier_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation_token(uuid, uuid) TO anon, authenticated;