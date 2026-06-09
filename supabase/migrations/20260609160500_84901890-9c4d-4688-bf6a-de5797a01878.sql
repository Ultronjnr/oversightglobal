
-- 1. Supplier bank details in a dedicated, Finance/Admin-only table
CREATE TABLE public.supplier_bank_details (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  bank_name text,
  bank_account_number text,
  bank_branch_code text,
  bank_account_type text DEFAULT 'Current/Cheque',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_bank_details TO authenticated;
GRANT ALL ON public.supplier_bank_details TO service_role;

ALTER TABLE public.supplier_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance/Admin can view supplier bank details"
ON public.supplier_bank_details FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin can insert supplier bank details"
ON public.supplier_bank_details FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin can update supplier bank details"
ON public.supplier_bank_details FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin can delete supplier bank details"
ON public.supplier_bank_details FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE TRIGGER update_supplier_bank_details_updated_at
BEFORE UPDATE ON public.supplier_bank_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data
INSERT INTO public.supplier_bank_details (supplier_id, organization_id, bank_name, bank_account_number, bank_branch_code, bank_account_type)
SELECT id, organization_id, bank_name, bank_account_number, bank_branch_code, COALESCE(bank_account_type, 'Current/Cheque')
FROM public.suppliers
WHERE bank_name IS NOT NULL OR bank_account_number IS NOT NULL OR bank_branch_code IS NOT NULL;

-- Remove sensitive columns from the broadly-readable suppliers table
ALTER TABLE public.suppliers
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_branch_code,
  DROP COLUMN IF EXISTS bank_account_type;

-- 2. Tighten PR documents storage SELECT policy
DROP POLICY IF EXISTS "Org members can view PR documents" ON storage.objects;

CREATE POLICY "PR participants can view PR documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pr-documents'
  AND auth.uid() IS NOT NULL
  AND (
    -- PR owner or org Finance/HOD/Admin can view documents for PRs in their org
    EXISTS (
      SELECT 1 FROM public.purchase_requisitions pr
      WHERE pr.document_url LIKE ('%' || objects.name || '%')
        AND pr.organization_id = get_user_organization(auth.uid())
        AND (
          pr.requested_by = auth.uid()
          OR has_role(auth.uid(), 'FINANCE'::app_role)
          OR has_role(auth.uid(), 'HOD'::app_role)
          OR has_role(auth.uid(), 'ADMIN'::app_role)
        )
    )
    -- The invited supplier for the PR
    OR EXISTS (
      SELECT 1
      FROM suppliers s
      JOIN quote_requests qr ON qr.supplier_id = s.id
      JOIN purchase_requisitions pr ON pr.id = qr.pr_id
      WHERE s.user_id = auth.uid()
        AND pr.document_url LIKE ('%' || objects.name || '%')
    )
    -- The original uploader can always view their own files
    OR (storage.foldername(objects.name))[1] = (auth.uid())::text
  )
);

-- 3. Hide raw invitation tokens from clients
REVOKE SELECT (token) ON public.invitations FROM authenticated;
REVOKE SELECT (token) ON public.invitations FROM anon;
REVOKE SELECT (token) ON public.supplier_invitations FROM authenticated;
REVOKE SELECT (token) ON public.supplier_invitations FROM anon;

-- Secure server-side resend for employee/generic invitations that rotates the token
CREATE OR REPLACE FUNCTION public.resend_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _org_id uuid;
  _inv record;
  _new_token text;
BEGIN
  IF NOT has_role(_admin_id, 'ADMIN'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can resend invitations');
  END IF;

  _org_id := get_user_organization(_admin_id);

  SELECT * INTO _inv
  FROM public.invitations
  WHERE id = _invitation_id AND organization_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF _inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending invitations can be resent');
  END IF;

  _new_token := encode(gen_random_bytes(32), 'hex');

  UPDATE public.invitations
  SET token = _new_token,
      expires_at = now() + interval '7 days'
  WHERE id = _invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', _new_token,
    'email', _inv.email,
    'role', _inv.role,
    'department', _inv.department
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resend_invitation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resend_invitation(uuid) TO authenticated;
