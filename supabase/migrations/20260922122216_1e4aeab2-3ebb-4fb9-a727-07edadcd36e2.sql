
REVOKE EXECUTE ON FUNCTION public.platform_overview() FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_organizations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_ad_performance() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.advertisement_visible_to_me(public.advertisements) FROM anon;
