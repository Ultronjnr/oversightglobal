REVOKE EXECUTE ON FUNCTION public.can_act_as_finance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_approved_not_paid_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_act_as_finance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_not_paid_queue() TO authenticated;