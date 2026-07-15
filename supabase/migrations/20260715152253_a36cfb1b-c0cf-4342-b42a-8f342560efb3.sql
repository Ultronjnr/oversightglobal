
DROP POLICY IF EXISTS "Suppliers can view orgs for their quote requests" ON public.organizations;

CREATE OR REPLACE FUNCTION public.get_supplier_visible_organization(_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  currency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.currency
  FROM public.organizations o
  WHERE o.id = _org_id
    AND EXISTS (
      SELECT 1
      FROM public.quote_requests qr
      JOIN public.suppliers s ON s.id = qr.supplier_id
      WHERE qr.organization_id = o.id
        AND s.user_id = auth.uid()
    )
$$;

REVOKE ALL ON FUNCTION public.get_supplier_visible_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_visible_organization(uuid) TO authenticated;

DROP POLICY IF EXISTS "Suppliers can upload quote documents" ON storage.objects;
CREATE POLICY "Suppliers can upload quote documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.quote_requests qr
    JOIN public.suppliers s ON s.id = qr.supplier_id
    WHERE s.user_id = auth.uid()
      AND qr.id::text = (storage.foldername(name))[2]
  )
);

DROP POLICY IF EXISTS "Suppliers can upload invoice documents" ON storage.objects;
CREATE POLICY "Suppliers can upload invoice documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.quotes q
    JOIN public.suppliers s ON s.id = q.supplier_id
    WHERE s.user_id = auth.uid()
      AND q.id::text = (storage.foldername(name))[2]
      AND q.status IN ('ACCEPTED', 'INVOICE_UPLOADED')
  )
);
