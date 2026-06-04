CREATE POLICY "Admins can delete org suppliers"
ON public.suppliers
FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN'::app_role)
);