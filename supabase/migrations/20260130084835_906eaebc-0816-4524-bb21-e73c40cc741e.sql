-- First, drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own PR documents" ON storage.objects;
DROP POLICY IF EXISTS "Approvers can view org PR documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload PR documents" ON storage.objects;

-- Create comprehensive storage policies for pr-documents bucket
-- Policy 1: Users in the same organization can view PR documents
CREATE POLICY "Org members can view PR documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pr-documents'
  AND auth.uid() IS NOT NULL
  AND (
    -- User can view if they belong to the same org as the PR owner
    EXISTS (
      SELECT 1 
      FROM public.profiles viewer
      INNER JOIN public.profiles uploader ON viewer.organization_id = uploader.organization_id
      WHERE viewer.id = auth.uid()
      AND uploader.id = (storage.foldername(objects.name))[1]::uuid
    )
    OR
    -- Suppliers can view documents for PRs linked to their quote requests
    EXISTS (
      SELECT 1
      FROM public.suppliers s
      INNER JOIN public.quote_requests qr ON qr.supplier_id = s.id
      INNER JOIN public.purchase_requisitions pr ON pr.id = qr.pr_id
      WHERE s.user_id = auth.uid()
      AND pr.document_url LIKE '%' || objects.name || '%'
    )
  )
);

-- Policy 2: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload PR documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pr-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(objects.name))[1] = auth.uid()::text
);

-- Policy 3: Users can update their own documents
CREATE POLICY "Users can update their own PR documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pr-documents'
  AND (storage.foldername(objects.name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own documents
CREATE POLICY "Users can delete their own PR documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pr-documents'
  AND (storage.foldername(objects.name))[1] = auth.uid()::text
);