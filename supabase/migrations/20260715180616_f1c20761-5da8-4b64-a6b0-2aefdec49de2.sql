-- Revoke anon EXECUTE on functions that should never be anon-callable
REVOKE EXECUTE ON FUNCTION public.create_donor_pool() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_donation_manager(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.post_pr_system_note(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.quote_request_current_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.quote_request_current_supplier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_join_org(uuid) FROM anon;

-- Revoke authenticated EXECUTE on RLS-helper SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.quote_request_current_org(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.quote_request_current_supplier(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_donation_manager(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_can_join_org(uuid) FROM authenticated;

-- Restrict verified supplier visibility
DROP POLICY IF EXISTS "Org members can view verified suppliers" ON public.suppliers;

CREATE POLICY "Privileged roles can view verified suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND is_verified = true
  AND (
    public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
  )
);