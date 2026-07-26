CREATE POLICY "Finance can update batch export pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'batch-exports'
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
)
WITH CHECK (
  bucket_id = 'batch-exports'
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);