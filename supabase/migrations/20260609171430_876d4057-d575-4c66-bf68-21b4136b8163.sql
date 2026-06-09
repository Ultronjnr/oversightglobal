-- 1. Remove supplier bank columns from transactions (sensitive data exposed to employees).
--    Banking details live in supplier_bank_details (FINANCE/ADMIN only).
ALTER TABLE public.transactions DROP COLUMN IF EXISTS bank_name;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS bank_account_number;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS bank_branch_code;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS bank_account_type;

-- 2. Restrict attachment reads: uploader, FINANCE/ADMIN/HOD, or PR requester only.
DROP POLICY IF EXISTS "Org members can view attachments" ON public.attachments;
CREATE POLICY "Authorized members can view attachments"
ON public.attachments
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    uploaded_by = auth.uid()
    OR has_role(auth.uid(), 'FINANCE'::app_role)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
    OR has_role(auth.uid(), 'HOD'::app_role)
    OR (
      pr_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.purchase_requisitions pr
        WHERE pr.id = attachments.pr_id AND pr.requested_by = auth.uid()
      )
    )
    OR (
      reimbursement_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.reimbursements r
        WHERE r.id = attachments.reimbursement_id AND r.employee_id = auth.uid()
      )
    )
  )
);

-- 3. Restrict pr-documents storage writes to org members with a valid PR relationship.
DROP POLICY IF EXISTS "Users can upload PR documents" ON storage.objects;
CREATE POLICY "Org members can upload PR documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'pr-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND get_user_organization(auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS "Users can update their own PR documents" ON storage.objects;
CREATE POLICY "Org members can update their own PR documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'pr-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND get_user_organization(auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own PR documents" ON storage.objects;
CREATE POLICY "Org members can delete their own PR documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'pr-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND get_user_organization(auth.uid()) IS NOT NULL
);