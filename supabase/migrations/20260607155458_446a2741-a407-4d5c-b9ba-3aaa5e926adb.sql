-- 1) Fix mutable search_path on email-queue helper functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 2) Revoke anon/public EXECUTE on email-queue helpers (used only by backend/service role)
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;

-- 3) Trigger/notification helper functions - not meant to be called directly
REVOKE EXECUTE ON FUNCTION public._notify_supplier(uuid, uuid, notification_type, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_payment_supplier_notify() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_quote_accepted_supplier_notify() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_quote_notifications() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_quote_request_supplier_notify() FROM anon, PUBLIC;

-- 4) Sensitive RPCs: remove anon access, keep them for authenticated users
REVOKE EXECUTE ON FUNCTION public.admin_approve_reimbursement(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_reimbursement(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.attach_batch_export_pdf(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_batch_export_pdf(uuid, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.register_batch_export(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_batch_export(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_supplier_invite(text, text, text, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_supplier_invite(text, text, text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resend_supplier_invite(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.resend_supplier_invite(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_supplier_invite(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_invite(uuid) TO authenticated;