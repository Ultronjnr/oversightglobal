
-- 1. Categories: allow EMPLOYEE and HOD to read categories in their org
CREATE POLICY "Employee can view org categories"
ON public.categories FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'EMPLOYEE'::app_role));

CREATE POLICY "HOD can view org categories"
ON public.categories FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'HOD'::app_role));

-- 2. Revoke anon EXECUTE on SECURITY DEFINER functions that should require sign-in
REVOKE EXECUTE ON FUNCTION public.create_donor_pool FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_donation_manager FROM anon;
REVOKE EXECUTE ON FUNCTION public.post_pr_system_note FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_supplier_visible_organization FROM anon;
REVOKE EXECUTE ON FUNCTION public.quote_request_current_org FROM anon;
REVOKE EXECUTE ON FUNCTION public.quote_request_current_supplier FROM anon;
