DROP POLICY IF EXISTS "Signed in users view advert images" ON storage.objects;
CREATE POLICY "Targeted users view advert images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'advertisement-images' AND (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.advertisements a
      WHERE a.image_url = storage.objects.name
        AND public.advertisement_visible_to_me(a)
    )
  )
);