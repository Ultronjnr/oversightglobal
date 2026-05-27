CREATE OR REPLACE FUNCTION public.assign_invitation_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  valid_invitation RECORD;
  user_email TEXT;
  user_org_id UUID;
BEGIN
    SELECT email, organization_id INTO user_email, user_org_id
    FROM public.profiles
    WHERE id = _user_id;

    IF user_email IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO valid_invitation
    FROM public.invitations
    WHERE LOWER(invitations.email) = LOWER(user_email)
      AND invitations.role = _role
      AND invitations.status = 'pending'
      AND invitations.expires_at > now()
    LIMIT 1;

    IF valid_invitation IS NULL THEN
        IF _role = 'ADMIN' THEN
            IF user_org_id IS NULL THEN
                RETURN FALSE;
            END IF;

            IF public.organization_has_admin(user_org_id) THEN
                RETURN FALSE;
            END IF;
        ELSIF NOT public.is_valid_self_role_assignment(_role) THEN
            RETURN FALSE;
        END IF;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);

    RETURN TRUE;
EXCEPTION
    WHEN unique_violation THEN
        RETURN TRUE;
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_invitation_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_invitation_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_invitation_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invitation_role(uuid, app_role) TO service_role;