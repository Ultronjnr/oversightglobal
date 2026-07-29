CREATE POLICY "Internal staff can view org projects"
ON public.donation_projects
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.is_internal_staff(auth.uid())
);

CREATE POLICY "Internal staff can view org donors"
ON public.organization_donors
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.is_internal_staff(auth.uid())
);