
CREATE POLICY "Donation managers read own org assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'donation-assets'
  AND public.is_donation_manager(auth.uid())
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
);

CREATE POLICY "Donation managers upload own org assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'donation-assets'
  AND public.is_donation_manager(auth.uid())
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
);

CREATE POLICY "Donation managers update own org assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'donation-assets'
  AND public.is_donation_manager(auth.uid())
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
);

CREATE POLICY "Donation managers delete own org assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'donation-assets'
  AND public.is_donation_manager(auth.uid())
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
);
