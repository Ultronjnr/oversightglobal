-- Fix: Allow ADMIN role during company signup when user is the first admin of a new org
-- This maintains security by checking that:
-- 1. The user has a profile with an organization_id
-- 2. That organization has no existing admins

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
    -- Get the user's email and organization from profiles
    SELECT email, organization_id INTO user_email, user_org_id
    FROM public.profiles
    WHERE id = _user_id;
    
    -- Verify there's a valid pending invitation for this user with matching role
    -- This prevents direct RPC calls from bypassing the invitation workflow
    SELECT * INTO valid_invitation
    FROM public.invitations
    WHERE LOWER(invitations.email) = LOWER(user_email)
    AND invitations.role = _role
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
    LIMIT 1;
    
    -- If no valid invitation found, check if it's a valid self-signup role
    IF valid_invitation IS NULL THEN
        -- Allow EMPLOYEE and SUPPLIER for self-signup
        IF _role IN ('EMPLOYEE', 'SUPPLIER') THEN
            -- Role is allowed, continue
            NULL;
        -- Allow ADMIN only if user is creating first org (no existing admin)
        ELSIF _role = 'ADMIN' AND user_org_id IS NOT NULL THEN
            -- Check if the organization has no existing admin
            IF public.organization_has_admin(user_org_id) THEN
                -- Organization already has an admin, deny
                RETURN FALSE;
            END IF;
            -- No existing admin, this is the first admin - allow
        ELSE
            -- Role not allowed for self-signup
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Insert the role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
    
    RETURN TRUE;
EXCEPTION
    WHEN unique_violation THEN
        -- Role already exists, which is fine
        RETURN TRUE;
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$function$;