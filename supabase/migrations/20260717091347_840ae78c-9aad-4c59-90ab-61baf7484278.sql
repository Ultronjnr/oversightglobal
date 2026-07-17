DROP POLICY IF EXISTS "Suppliers can create quotes for their requests" ON public.quotes;
CREATE POLICY "Suppliers can create quotes for their requests"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (SELECT s.id FROM public.suppliers s WHERE s.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.quote_requests qr
    WHERE qr.id = quotes.quote_request_id
      AND qr.supplier_id = quotes.supplier_id
      AND qr.pr_id = quotes.pr_id
      AND qr.organization_id = quotes.organization_id
      AND qr.status IN ('PENDING', 'ACCEPTED')
  )
);