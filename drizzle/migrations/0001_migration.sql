CREATE POLICY "Staff can upload own scan documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='invoice-documents' AND (storage.foldername(name))[1]=auth.uid()::text AND (storage.foldername(name))[2]='scan' AND (has_role(auth.uid(),'EMPLOYEE'::app_role) OR has_role(auth.uid(),'HOD'::app_role)));
CREATE POLICY "Staff can view own scan documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='invoice-documents' AND (storage.foldername(name))[1]=auth.uid()::text AND (storage.foldername(name))[2]='scan' AND (has_role(auth.uid(),'EMPLOYEE'::app_role) OR has_role(auth.uid(),'HOD'::app_role)));
CREATE POLICY "Staff can delete own scan documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='invoice-documents' AND (storage.foldername(name))[1]=auth.uid()::text AND (storage.foldername(name))[2]='scan' AND (has_role(auth.uid(),'EMPLOYEE'::app_role) OR has_role(auth.uid(),'HOD'::app_role)));
DROP POLICY "Org Finance/Admin can insert OCR analyses" ON public.ocr_analyses;
CREATE POLICY "Org staff can insert OCR analyses" ON public.ocr_analyses FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization(auth.uid()) AND (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'FINANCE'::app_role) OR has_role(auth.uid(),'EMPLOYEE'::app_role) OR has_role(auth.uid(),'HOD'::app_role)));