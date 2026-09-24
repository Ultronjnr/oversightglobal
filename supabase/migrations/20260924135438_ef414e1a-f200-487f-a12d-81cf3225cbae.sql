REVOKE EXECUTE ON FUNCTION public.plan_limit_for_org(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_enforce_plan_limits() FROM PUBLIC, anon, authenticated;