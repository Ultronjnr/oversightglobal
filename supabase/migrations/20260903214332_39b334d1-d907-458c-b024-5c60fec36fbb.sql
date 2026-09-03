REVOKE ALL ON FUNCTION public.tg_enforce_pr_approval_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_enforce_reimbursement_approval_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.default_role_permission(public.app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.default_role_permission(public.app_role, text) TO authenticated;