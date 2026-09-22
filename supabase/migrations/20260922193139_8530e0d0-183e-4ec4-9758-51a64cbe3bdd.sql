CREATE POLICY "Signed in users view advert images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'advertisement-images');
CREATE POLICY "Platform staff upload advert images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'advertisement-images' AND public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform staff update advert images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'advertisement-images' AND public.is_platform_admin(auth.uid()))
WITH CHECK (bucket_id = 'advertisement-images' AND public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform staff delete advert images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'advertisement-images' AND public.is_platform_admin(auth.uid()));