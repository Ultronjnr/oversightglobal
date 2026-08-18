CREATE OR REPLACE FUNCTION public.complete_invitation_signup(_token text, _email text, _user_id uuid, _name text, _surname text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_inv record;
  v_auth_email text;
  _hash text := encode(extensions.digest(_token, 'sha256'), 'hex');
BEGIN
  SELECT id, email, role, department, organization_id, status, expires_at
    INTO v_inv FROM public.invitations
  WHERE token_hash = _hash AND lower(email) = lower(_email) LIMIT 1;

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation');
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

  -- Profile is (re)pointed at the inviting organisation. Existing users who
  -- accept an invitation move to the inviting org with the invited department.
  INSERT INTO public.profiles (id, email, name, surname, department, organization_id)
  VALUES (_user_id, lower(_email), _name, _surname, v_inv.department, v_inv.organization_id)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
        surname = COALESCE(NULLIF(EXCLUDED.surname, ''), public.profiles.surname),
        department = EXCLUDED.department,
        organization_id = EXCLUDED.organization_id;

  -- The platform is single-role per user: the invited role replaces any role
  -- the user previously held, so portal routing is never ambiguous.
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> v_inv.role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, v_inv.role) ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.invitations SET status = 'accepted' WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'role', v_inv.role, 'organization_id', v_inv.organization_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_invitation_signup(text, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_invitation_signup(text, text, uuid, text, text) TO anon, authenticated, service_role;

-- Clean up historic duplicate roles so existing users route to one portal.
DELETE FROM public.user_roles ur
USING public.user_roles keep
WHERE ur.user_id = keep.user_id
  AND ur.ctid <> keep.ctid
  AND keep.ctid = (
    SELECT k.ctid FROM public.user_roles k
    WHERE k.user_id = ur.user_id
    ORDER BY (CASE k.role WHEN 'ADMIN' THEN 1 WHEN 'FINANCE' THEN 2 WHEN 'HOD' THEN 3 WHEN 'SUPPLIER' THEN 4 ELSE 5 END)
    LIMIT 1
  );