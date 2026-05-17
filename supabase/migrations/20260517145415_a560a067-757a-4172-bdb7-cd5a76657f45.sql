
-- Allow org members to upload to chat/<prId>/... in pr-documents
CREATE POLICY "Org members can upload PR chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pr-documents'
  AND (storage.foldername(name))[1] = 'chat'
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id::text = (storage.foldername(name))[2]
      AND pr.organization_id = public.get_user_organization(auth.uid())
  )
  AND (
    public.has_role(auth.uid(), 'EMPLOYEE'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
    OR public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
  )
);

-- Allow org members to view chat/<prId>/... in pr-documents
CREATE POLICY "Org members can view PR chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pr-documents'
  AND (storage.foldername(name))[1] = 'chat'
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id::text = (storage.foldername(name))[2]
      AND pr.organization_id = public.get_user_organization(auth.uid())
  )
  AND (
    public.has_role(auth.uid(), 'EMPLOYEE'::app_role)
    OR public.has_role(auth.uid(), 'HOD'::app_role)
    OR public.has_role(auth.uid(), 'FINANCE'::app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
  )
);
