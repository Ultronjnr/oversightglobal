GRANT EXECUTE ON FUNCTION public.register_batch_export(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_batch_export_pdf(uuid, uuid, text) TO authenticated;