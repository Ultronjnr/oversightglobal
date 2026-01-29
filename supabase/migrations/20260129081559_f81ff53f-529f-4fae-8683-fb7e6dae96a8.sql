-- Fix: User Personal Information Exposed to Unauthenticated Visitors
-- The profiles table SELECT policy allows unauthenticated access via the OR condition

-- Drop the existing policy that allows unauthenticated access
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create a new policy that requires authentication
-- Users can view their own profile OR profiles within their organization (when authenticated)
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    id = auth.uid() 
    OR organization_id = get_user_organization(auth.uid())
  )
);


-- Fix: Company Information Leaked to Competitors  
-- The organizations table SELECT policy allows access to users without a profile (unauthenticated)

-- Drop the existing policy that allows unauthenticated access
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

-- Create a new policy that requires authentication
-- Users can only view their own organization OR view any organization during signup flow
-- (when they're authenticated but don't have a profile yet)
CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    id = get_user_organization(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
  )
);