
-- Create a secure RPC to validate supplier invitation tokens
-- This replaces the overly permissive public SELECT policy
CREATE OR REPLACE FUNCTION public.validate_supplier_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invitation RECORD;
BEGIN
  SELECT id, email, company_name, organization_id, status, expires_at
  INTO _invitation
  FROM public.supplier_invitations
  WHERE token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;

  IF _invitation.status != 'PENDING' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has already been used');
  END IF;

  IF _invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', _invitation.id,
    'email', _invitation.email,
    'company_name', _invitation.company_name,
    'organization_id', _invitation.organization_id
  );
END;
$$;

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can validate pending supplier invitation tokens" ON public.supplier_invitations;

-- Also create a secure RPC to mark invitation as accepted (since unauthenticated users can't UPDATE)
CREATE OR REPLACE FUNCTION public.accept_supplier_invitation_token(_token uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.supplier_invitations
  SET status = 'ACCEPTED'
  WHERE token = _token
  AND status = 'PENDING'
  AND expires_at > now();
  
  RETURN FOUND;
END;
$$;
