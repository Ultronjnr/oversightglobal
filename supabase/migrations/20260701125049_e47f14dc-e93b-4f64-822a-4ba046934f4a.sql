-- Fix 1: Restrict attachments storage SELECT to mirror table-level RLS
DROP POLICY IF EXISTS "Org members can read attachments storage" ON storage.objects;

CREATE POLICY "Authorized members can read attachments storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
  AND EXISTS (
    SELECT 1 FROM public.attachments a
    WHERE a.file_path = storage.objects.name
      AND a.organization_id = get_user_organization(auth.uid())
      AND (
        a.uploaded_by = auth.uid()
        OR has_role(auth.uid(), 'FINANCE'::app_role)
        OR has_role(auth.uid(), 'ADMIN'::app_role)
        OR has_role(auth.uid(), 'HOD'::app_role)
        OR (a.pr_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.purchase_requisitions pr
          WHERE pr.id = a.pr_id AND pr.requested_by = auth.uid()
        ))
        OR (a.reimbursement_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.reimbursements r
          WHERE r.id = a.reimbursement_id AND r.employee_id = auth.uid()
        ))
      )
  )
);

-- Fix 2: Add UPDATE and DELETE policies for Finance/Admin on payment_batches
CREATE POLICY "Finance/Admin can update org batches"
ON public.payment_batches
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin can delete org batches"
ON public.payment_batches
FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);