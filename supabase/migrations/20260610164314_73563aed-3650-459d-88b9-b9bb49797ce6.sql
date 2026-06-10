-- Finding 1: Remove overly-broad folder-ownership OR branch from PR document reads
DROP POLICY IF EXISTS "PR participants can view PR documents" ON storage.objects;

CREATE POLICY "PR participants can view PR documents"
ON storage.objects
FOR SELECT
USING (
  (bucket_id = 'pr-documents'::text)
  AND (auth.uid() IS NOT NULL)
  AND (
    (EXISTS (
      SELECT 1
      FROM purchase_requisitions pr
      WHERE (pr.document_url ~~ (('%'::text || objects.name) || '%'::text))
        AND (pr.organization_id = get_user_organization(auth.uid()))
        AND (
          (pr.requested_by = auth.uid())
          OR has_role(auth.uid(), 'FINANCE'::app_role)
          OR has_role(auth.uid(), 'HOD'::app_role)
          OR has_role(auth.uid(), 'ADMIN'::app_role)
        )
    ))
    OR (EXISTS (
      SELECT 1
      FROM ((suppliers s
        JOIN quote_requests qr ON ((qr.supplier_id = s.id)))
        JOIN purchase_requisitions pr ON ((pr.id = qr.pr_id)))
      WHERE (s.user_id = auth.uid())
        AND (pr.document_url ~~ (('%'::text || objects.name) || '%'::text))
    ))
  )
);

-- Finding 2: Allow Finance/Admin to delete and update reimbursement proof files for their org
CREATE POLICY "Finance/Admin can delete org reimbursement proofs"
ON storage.objects
FOR DELETE
USING (
  (bucket_id = 'reimbursement-documents'::text)
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
  AND (EXISTS (
    SELECT 1 FROM reimbursements r
    WHERE r.proof_document_url = objects.name
      AND r.organization_id = get_user_organization(auth.uid())
  ))
);

CREATE POLICY "Finance/Admin can update org reimbursement proofs"
ON storage.objects
FOR UPDATE
USING (
  (bucket_id = 'reimbursement-documents'::text)
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
  AND (EXISTS (
    SELECT 1 FROM reimbursements r
    WHERE r.proof_document_url = objects.name
      AND r.organization_id = get_user_organization(auth.uid())
  ))
)
WITH CHECK (
  (bucket_id = 'reimbursement-documents'::text)
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);
