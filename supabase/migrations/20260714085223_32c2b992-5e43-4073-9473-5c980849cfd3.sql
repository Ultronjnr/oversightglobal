
-- Finalises a regular (non-supplier) invitation acceptance in one call, using
-- security definer so it works before the user has confirmed their email (no session).
CREATE OR REPLACE FUNCTION public.complete_invitation_signup(
  _token text,
  _email text,
  _user_id uuid,
  _name text,
  _surname text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_auth_email text;
BEGIN
  -- Load invitation
  SELECT id, email, role, department, organization_id, status, expires_at, token
    INTO v_inv
  FROM public.invitations
  WHERE token = _token
    AND lower(email) = lower(_email)
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already used');
  END IF;

  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation expired');
  END IF;

  -- Verify the supplied user_id actually belongs to this email (prevents hijack)
  SELECT lower(email) INTO v_auth_email FROM auth.users WHERE id = _user_id;
  IF v_auth_email IS NULL OR v_auth_email <> lower(_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated user mismatch');
  END IF;

  -- Upsert profile
  INSERT INTO public.profiles (id, email, name, surname, department, organization_id)
  VALUES (
    _user_id,
    lower(_email),
    _name,
    _surname,
    v_inv.department,
    v_inv.organization_id
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        surname = COALESCE(EXCLUDED.surname, public.profiles.surname),
        department = COALESCE(EXCLUDED.department, public.profiles.department),
        organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id);

  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, v_inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark invitation accepted
  UPDATE public.invitations
     SET status = 'accepted'
   WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'role', v_inv.role);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_invitation_signup(text, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_invitation_signup(text, text, uuid, text, text) TO anon, authenticated, service_role;


-- Creates the profile row for a supplier invitation acceptance. The supplier
-- record itself is created by accept_supplier_invitation which already runs
-- security definer.
CREATE OR REPLACE FUNCTION public.complete_supplier_profile(
  _token text,
  _email text,
  _user_id uuid,
  _name text,
  _phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_auth_email text;
BEGIN
  SELECT id, email, role, status, expires_at
    INTO v_inv
  FROM public.invitations
  WHERE token = _token
    AND lower(email) = lower(_email)
    AND role = 'SUPPLIER'
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid supplier invitation');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already used');
  END IF;

  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation expired');
  END IF;

  SELECT lower(email) INTO v_auth_email FROM auth.users WHERE id = _user_id;
  IF v_auth_email IS NULL OR v_auth_email <> lower(_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated user mismatch');
  END IF;

  INSERT INTO public.profiles (id, email, name, phone)
  VALUES (_user_id, lower(_email), _name, _phone)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_supplier_profile(text, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_supplier_profile(text, text, uuid, text, text) TO anon, authenticated, service_role;
