-- Allow suppliers to update their own quote requests (for accept/decline)
CREATE POLICY "Suppliers can update their quote requests"
ON public.quote_requests
FOR UPDATE
USING (
    supplier_id IN (
        SELECT id FROM public.suppliers WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    supplier_id IN (
        SELECT id FROM public.suppliers WHERE user_id = auth.uid()
    )
);