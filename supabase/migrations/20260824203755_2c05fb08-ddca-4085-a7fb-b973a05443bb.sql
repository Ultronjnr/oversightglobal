CREATE POLICY "Internal staff upload manual quote documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quote-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
  )
);

CREATE POLICY "Internal staff view own quote uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quote-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
  )
);

CREATE POLICY "HOD can view org quote documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quote-documents'
  AND public.has_role(auth.uid(), 'HOD'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE q.document_url = storage.objects.name
      AND q.organization_id = p.organization_id
  )
);

CREATE POLICY "Internal staff delete own quote uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'quote-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
  )
);