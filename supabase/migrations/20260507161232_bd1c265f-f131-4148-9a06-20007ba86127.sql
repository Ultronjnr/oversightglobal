
-- 1) Fix organizations: remove unauthenticated branch, scope to authenticated
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (id = public.get_user_organization(auth.uid()));

-- 2) Tighten profiles: scope to authenticated only
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization(auth.uid())
  )
);

-- 3) Supplier invitations: prevent admins from tampering with token/email/org/invited_by
DROP POLICY IF EXISTS "Admins can update supplier invitations" ON public.supplier_invitations;
CREATE POLICY "Admins can update supplier invitations"
ON public.supplier_invitations
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_role(auth.uid(), 'ADMIN'::app_role)
)
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  AND token = (SELECT si.token FROM public.supplier_invitations si WHERE si.id = supplier_invitations.id)
  AND email = (SELECT si.email FROM public.supplier_invitations si WHERE si.id = supplier_invitations.id)
  AND invited_by = (SELECT si.invited_by FROM public.supplier_invitations si WHERE si.id = supplier_invitations.id)
);

-- 4) Storage: scope reimbursement-documents access by organization
DROP POLICY IF EXISTS "Finance can view all reimbursement proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view all reimbursement proofs" ON storage.objects;

CREATE POLICY "Finance can view org reimbursement proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reimbursement-documents'
  AND public.has_role(auth.uid(), 'FINANCE'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.reimbursements r
    WHERE r.proof_document_url = storage.objects.name
      AND r.organization_id = public.get_user_organization(auth.uid())
  )
);

CREATE POLICY "Admin can view org reimbursement proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reimbursement-documents'
  AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.reimbursements r
    WHERE r.proof_document_url = storage.objects.name
      AND r.organization_id = public.get_user_organization(auth.uid())
  )
);

-- 5) Revoke EXECUTE on SECURITY DEFINER RPCs from anon (they are intended for authenticated users)
REVOKE EXECUTE ON FUNCTION public.accept_invitation(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_invitation(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_supplier_invitation_token(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_supplier_invitation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_supplier_invitation(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_quote_and_reject_others(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_payment_batch(jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_invitation_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_supplier_invitation(text, text, uuid, text, text[], text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_supplier_invitation(text, text, uuid, text, text[], text, text, text, text, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation_token(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_supplier_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quote_and_reject_others(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_batch(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invitation_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation(text, text, uuid, text, text[], text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation(text, text, uuid, text, text[], text, text, text, text, text) TO authenticated;
