-- Create storage bucket for PR documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('pr-documents', 'pr-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload PR documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pr-documents' 
  AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
);

-- Users can view their own documents
CREATE POLICY "Users can view their own PR documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pr-documents' 
  AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
);

-- Allow HOD/Finance/Admin to view PR documents in their org
CREATE POLICY "Approvers can view org PR documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pr-documents'
  AND (
    has_role(auth.uid(), 'HOD') 
    OR has_role(auth.uid(), 'FINANCE') 
    OR has_role(auth.uid(), 'ADMIN')
  )
);