DROP POLICY IF EXISTS "Suppliers can create invoices for accepted quotes" ON public.invoices;

CREATE POLICY "Suppliers can create invoices for accepted quotes"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    JOIN public.suppliers s ON s.id = q.supplier_id
    WHERE q.id = invoices.quote_id
      AND s.user_id = auth.uid()
      AND q.status IN ('ACCEPTED', 'INVOICE_UPLOADED')
      AND q.organization_id = invoices.organization_id
      AND q.pr_id = invoices.pr_id
      AND q.supplier_id = invoices.supplier_id
  )
);