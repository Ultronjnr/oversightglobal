-- Add document_url column to quotes table for PDF uploads
ALTER TABLE public.quotes ADD COLUMN document_url TEXT;

-- Create storage bucket for quote documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-documents', 'quote-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for quote-documents bucket

-- Suppliers can upload to their own folder
CREATE POLICY "Suppliers can upload quote documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'quote-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Suppliers can view their own uploads
CREATE POLICY "Suppliers can view own quote documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Finance can view all quote documents in their org
CREATE POLICY "Finance can view quote documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND has_role(auth.uid(), 'FINANCE')
);

-- Admin can view all quote documents in their org
CREATE POLICY "Admin can view quote documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND has_role(auth.uid(), 'ADMIN')
);