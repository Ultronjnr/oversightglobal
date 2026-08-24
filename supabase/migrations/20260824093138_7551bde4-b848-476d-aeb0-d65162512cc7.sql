REVOKE ALL ON FUNCTION public.tg_pr_funding_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_pr_funding_propagate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_inherit_funding_from_pr() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_settle_project_funds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_project_budget_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_budget_summary(uuid) TO authenticated;