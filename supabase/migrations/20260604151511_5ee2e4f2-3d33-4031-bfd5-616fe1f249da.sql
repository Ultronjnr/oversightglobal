CREATE POLICY "Finance can upload batch export pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'batch-exports'
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
  AND (public.has_role(auth.uid(), 'FINANCE'::app_role) OR public.has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance can read batch export pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'batch-exports'
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
  AND (public.has_role(auth.uid(), 'FINANCE'::app_role) OR public.has_role(auth.uid(), 'ADMIN'::app_role))
);