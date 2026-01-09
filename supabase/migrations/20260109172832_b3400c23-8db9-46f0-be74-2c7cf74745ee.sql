-- Create invitations table
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role app_role NOT NULL,
    department TEXT,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    invited_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can INSERT invitations for their organization
CREATE POLICY "Admins can create invitations for their org"
ON public.invitations
FOR INSERT
WITH CHECK (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'ADMIN'::app_role)
    AND invited_by = auth.uid()
);

-- Admins can SELECT invitations for their organization
CREATE POLICY "Admins can view invitations for their org"
ON public.invitations
FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Admins can UPDATE invitations for their organization (to expire/cancel)
CREATE POLICY "Admins can update invitations for their org"
ON public.invitations
FOR UPDATE
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Create function to validate and accept invitation (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.validate_invitation(_token TEXT, _email TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role app_role,
    department TEXT,
    organization_id UUID,
    status TEXT,
    expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.email,
        i.role,
        i.department,
        i.organization_id,
        i.status,
        i.expires_at
    FROM public.invitations i
    WHERE i.token = _token 
    AND LOWER(i.email) = LOWER(_email)
    LIMIT 1;
END;
$$;

-- Create function to mark invitation as accepted
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT, _email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invitation_record RECORD;
BEGIN
    -- Get the invitation
    SELECT * INTO invitation_record
    FROM public.invitations
    WHERE token = _token 
    AND LOWER(email) = LOWER(_email)
    AND status = 'pending'
    AND expires_at > now()
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Mark as accepted
    UPDATE public.invitations
    SET status = 'accepted'
    WHERE id = invitation_record.id;
    
    RETURN TRUE;
END;
$$;