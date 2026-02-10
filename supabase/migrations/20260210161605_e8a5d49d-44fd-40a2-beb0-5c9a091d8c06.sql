
-- Fix: Quote documents storage policies - add organization scoping

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Finance can view quote documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view quote documents" ON storage.objects;

-- Recreate with organization scoping
CREATE POLICY "Finance can view org quote documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND has_role(auth.uid(), 'FINANCE')
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE q.document_url LIKE '%' || storage.objects.name || '%'
    AND q.organization_id = p.organization_id
  )
);

CREATE POLICY "Admin can view org quote documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND has_role(auth.uid(), 'ADMIN')
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE q.document_url LIKE '%' || storage.objects.name || '%'
    AND q.organization_id = p.organization_id
  )
);
