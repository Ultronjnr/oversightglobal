REVOKE EXECUTE ON FUNCTION public.log_transaction_event(uuid, uuid, uuid, text, text, text, text, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_te_pr() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_te_quote() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_te_invoice() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_te_transaction() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_te_allocation() FROM anon, authenticated, public;
