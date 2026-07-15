
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.invitations
SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
WHERE token IS NOT NULL AND token_hash IS NULL;

ALTER TABLE public.invitations DROP COLUMN IF EXISTS token CASCADE;

CREATE OR REPLACE FUNCTION public.hash_invitation_token()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.token_hash IS NOT NULL AND length(NEW.token_hash) <> 64 THEN
    NEW.token_hash := encode(extensions.digest(NEW.token_hash, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_hash_invitation_token ON public.invitations;
CREATE TRIGGER trg_hash_invitation_token
BEFORE INSERT OR UPDATE OF token_hash ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.hash_invitation_token();

CREATE OR REPLACE FUNCTION public.validate_invitation(_token text, _email text)
RETURNS TABLE(id uuid, email text, role app_role, department text, organization_id uuid, status text, expires_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _hash text := encode(extensions.digest(_token, 'sha256'), 'hex');
BEGIN
  RETURN QUERY
  SELECT i.id, i.email, i.role, i.department, i.organization_id, i.status, i.expires_at
  FROM public.invitations i
  WHERE i.token_hash = _hash AND LOWER(i.email) = LOWER(_email)
  LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text, _email text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  invitation_record RECORD;
  _hash text := encode(extensions.digest(_token, 'sha256'), 'hex');
BEGIN
  SELECT * INTO invitation_record FROM public.invitations
  WHERE token_hash = _hash AND LOWER(email) = LOWER(_email)
    AND status = 'pending' AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.invitations SET status = 'accepted' WHERE id = invitation_record.id;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_invitation_signup(_token text, _email text, _user_id uuid, _name text, _surname text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_inv record;
  v_auth_email text;
  _hash text := encode(extensions.digest(_token, 'sha256'), 'hex');
BEGIN
  SELECT id, email, role, department, organization_id, status, expires_at
    INTO v_inv FROM public.invitations
  WHERE token_hash = _hash AND lower(email) = lower(_email) LIMIT 1;

  IF v_inv.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation'); END IF;
  IF v_inv.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation already used'); END IF;
  IF v_inv.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation expired'); END IF;

  SELECT lower(email) INTO v_auth_email FROM auth.users WHERE id = _user_id;
  IF v_auth_email IS NULL OR v_auth_email <> lower(_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated user mismatch');
  END IF;

  INSERT INTO public.profiles (id, email, name, surname, department, organization_id)
  VALUES (_user_id, lower(_email), _name, _surname, v_inv.department, v_inv.organization_id)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        surname = COALESCE(EXCLUDED.surname, public.profiles.surname),
        department = COALESCE(EXCLUDED.department, public.profiles.department),
        organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, v_inv.role) ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.invitations SET status = 'accepted' WHERE id = v_inv.id;
  RETURN jsonb_build_object('success', true, 'role', v_inv.role);
END; $$;

CREATE OR REPLACE FUNCTION public.resend_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _org_id uuid; _inv record; _new_token text;
BEGIN
  IF NOT has_role(_admin_id, 'ADMIN'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can resend invitations');
  END IF;
  _org_id := get_user_organization(_admin_id);

  SELECT * INTO _inv FROM public.invitations
  WHERE id = _invitation_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation not found'); END IF;
  IF _inv.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Only pending invitations can be resent'); END IF;

  _new_token := encode(gen_random_bytes(32), 'hex');
  UPDATE public.invitations
  SET token_hash = encode(extensions.digest(_new_token, 'sha256'), 'hex'),
      expires_at = now() + interval '7 days'
  WHERE id = _invitation_id;

  RETURN jsonb_build_object('success', true, 'token', _new_token,
    'email', _inv.email, 'role', _inv.role, 'department', _inv.department);
END; $$;
