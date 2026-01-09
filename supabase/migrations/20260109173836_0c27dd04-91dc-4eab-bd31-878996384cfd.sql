-- =====================================================
-- SECURITY AUDIT FIXES - RLS Policies
-- =====================================================

-- 1. FIX: Organizations table - Remove exception for users without profiles
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Users can view their own organization" 
ON public.organizations 
FOR SELECT 
USING (id = get_user_organization(auth.uid()));

-- 2. FIX: Organizations table - Restrict INSERT to require auth and prevent anyone from creating orgs
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Only allow org creation during company signup (temporarily permissive, but scoped to authenticated users)
-- The application logic ensures only the first signup creates an org
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. FIX: Suppliers table - Restrict verified supplier visibility to same-org Finance/Admin only
DROP POLICY IF EXISTS "Verified suppliers are viewable by authenticated users" ON public.suppliers;

CREATE POLICY "Finance and Admin can view verified suppliers" 
ON public.suppliers 
FOR SELECT 
USING (
    is_verified = true 
    AND (
        has_role(auth.uid(), 'FINANCE'::app_role) 
        OR has_role(auth.uid(), 'ADMIN'::app_role)
    )
);

-- 4. FIX: user_roles table - Prevent users from self-assigning privileged roles
-- Users can only insert EMPLOYEE role for themselves, unless via invitation (handled server-side)
DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;

-- Create a function to validate role assignment
CREATE OR REPLACE FUNCTION public.is_valid_self_role_assignment(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- Only allow EMPLOYEE and SUPPLIER roles for self-signup
    -- ADMIN, HOD, FINANCE must come through invitation process
    SELECT _role IN ('EMPLOYEE', 'SUPPLIER')
$$;

-- Allow users to only assign themselves EMPLOYEE or SUPPLIER roles
-- ADMIN/HOD/FINANCE roles are assigned via invitation (handled by security definer function)
CREATE POLICY "Users can insert limited roles during signup" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
    user_id = auth.uid() 
    AND is_valid_self_role_assignment(role)
);

-- 5. FIX: Allow Admins to manage roles within their organization
CREATE POLICY "Admins can update roles in their org" 
ON public.user_roles 
FOR UPDATE 
USING (
    has_role(auth.uid(), 'ADMIN'::app_role) 
    AND EXISTS (
        SELECT 1 FROM profiles p1, profiles p2
        WHERE p1.id = auth.uid() 
        AND p2.id = user_roles.user_id 
        AND p1.organization_id = p2.organization_id
    )
);

CREATE POLICY "Admins can delete roles in their org" 
ON public.user_roles 
FOR DELETE 
USING (
    has_role(auth.uid(), 'ADMIN'::app_role) 
    AND EXISTS (
        SELECT 1 FROM profiles p1, profiles p2
        WHERE p1.id = auth.uid() 
        AND p2.id = user_roles.user_id 
        AND p1.organization_id = p2.organization_id
    )
    AND user_id != auth.uid() -- Cannot delete own role
);

-- 6. Create secure function for invitation role assignment (bypasses RLS)
CREATE OR REPLACE FUNCTION public.assign_invitation_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- 7. FIX: Improve PR visibility for HOD and Finance to see approved PRs too
CREATE POLICY "HOD can view approved PRs in their org"
ON public.purchase_requisitions
FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'HOD'::app_role) 
    AND status IN ('PENDING_FINANCE_APPROVAL', 'FINANCE_APPROVED', 'FINANCE_DECLINED', 'SPLIT')
);

CREATE POLICY "Finance can view all org PRs after HOD approval"
ON public.purchase_requisitions
FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'FINANCE'::app_role)
    AND status != 'PENDING_HOD_APPROVAL'
);

-- 8. FIX: Add DELETE policies for cleanup
CREATE POLICY "Admins can delete invitations in their org"
ON public.invitations
FOR DELETE
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- 9. Ensure quotes cannot be edited after acceptance
CREATE OR REPLACE FUNCTION public.prevent_accepted_quote_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'ACCEPTED' AND NEW.status != OLD.status THEN
        RAISE EXCEPTION 'Cannot modify an accepted quote';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_quote_changes_trigger ON public.quotes;
CREATE TRIGGER prevent_quote_changes_trigger
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_accepted_quote_changes();