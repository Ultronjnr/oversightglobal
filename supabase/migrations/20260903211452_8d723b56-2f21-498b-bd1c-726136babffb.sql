
CREATE POLICY "Requesters insert manual quotes on own PR"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  source = 'MANUAL'
  AND organization_id = get_user_organization(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = quotes.pr_id
      AND pr.organization_id = quotes.organization_id
      AND pr.requested_by = auth.uid()
  )
);

CREATE POLICY "Internal staff view org quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    has_role(auth.uid(), 'FINANCE'::app_role)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
    OR has_role(auth.uid(), 'HOD'::app_role)
  )
);

CREATE POLICY "Requesters view quotes on own PR"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = quotes.pr_id
      AND pr.requested_by = auth.uid()
  )
);
