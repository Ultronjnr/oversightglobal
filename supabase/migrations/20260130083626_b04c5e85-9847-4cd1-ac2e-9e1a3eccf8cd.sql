-- Allow suppliers to view purchase_requisitions for quote requests assigned to them
CREATE POLICY "Suppliers can view PRs for their quote requests"
ON public.purchase_requisitions
FOR SELECT
USING (
  id IN (
    SELECT qr.pr_id 
    FROM public.quote_requests qr
    INNER JOIN public.suppliers s ON s.id = qr.supplier_id
    WHERE s.user_id = auth.uid()
  )
);

-- Allow suppliers to view organizations for quote requests assigned to them
CREATE POLICY "Suppliers can view orgs for their quote requests"
ON public.organizations
FOR SELECT
USING (
  id IN (
    SELECT qr.organization_id 
    FROM public.quote_requests qr
    INNER JOIN public.suppliers s ON s.id = qr.supplier_id
    WHERE s.user_id = auth.uid()
  )
);