-- Fix: Cross-Organization Document Access Through Storage Policies
-- The current policy allows HOD/FINANCE/ADMIN to view ANY document in the bucket
-- without verifying the document belongs to their organization.

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Approvers can view org PR documents" ON storage.objects;

-- Create a secure policy that verifies organization membership
-- Documents are stored with folder structure /{user_id}/... 
-- so we verify the uploader belongs to the same organization as the viewer
CREATE POLICY "Approvers can view org PR documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pr-documents'
  AND (
    public.has_role(auth.uid(), 'HOD') 
    OR public.has_role(auth.uid(), 'FINANCE') 
    OR public.has_role(auth.uid(), 'ADMIN')
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p1, public.profiles p2
    WHERE p1.id = auth.uid()
    AND p2.id::text = (storage.foldername(storage.objects.name))[1]
    AND p1.organization_id = p2.organization_id
    AND p1.organization_id IS NOT NULL
  )
);