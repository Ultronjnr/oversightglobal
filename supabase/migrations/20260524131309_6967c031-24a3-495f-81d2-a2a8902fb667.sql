
-- Attachment kind enum
DO $$ BEGIN
  CREATE TYPE public.attachment_kind AS ENUM ('INVOICE', 'RECEIPT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  kind public.attachment_kind NOT NULL DEFAULT 'OTHER',
  pr_id uuid NULL,
  transaction_id uuid NULL,
  reimbursement_id uuid NULL,
  supplier_id uuid NULL,
  supplier_name text NULL,
  invoice_number text NULL,
  invoice_date date NULL,
  vat_number text NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  notes text NULL,
  ai_extracted jsonb NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_org ON public.attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_attachments_pr ON public.attachments(pr_id);
CREATE INDEX IF NOT EXISTS idx_attachments_txn ON public.attachments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_attachments_reimb ON public.attachments(reimbursement_id);
CREATE INDEX IF NOT EXISTS idx_attachments_supplier ON public.attachments(supplier_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view attachments"
ON public.attachments FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Finance/Admin can insert org attachments"
ON public.attachments FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND uploaded_by = auth.uid()
  AND (public.has_role(auth.uid(), 'FINANCE'::app_role) OR public.has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Employees can insert attachments on own PR/reimbursement"
ON public.attachments FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND uploaded_by = auth.uid()
  AND (
    (pr_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.purchase_requisitions pr
      WHERE pr.id = attachments.pr_id AND pr.requested_by = auth.uid()
    ))
    OR
    (reimbursement_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = attachments.reimbursement_id AND r.employee_id = auth.uid()
    ))
  )
);

CREATE POLICY "Finance/Admin can delete org attachments"
ON public.attachments FOR DELETE
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'FINANCE'::app_role) OR public.has_role(auth.uid(), 'ADMIN'::app_role))
);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: files are stored under <organization_id>/<...>
CREATE POLICY "Org members can read attachments storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
);

CREATE POLICY "Org members can upload attachments storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
);

CREATE POLICY "Finance/Admin can delete attachments storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = public.get_user_organization(auth.uid())::text
  AND (public.has_role(auth.uid(), 'FINANCE'::app_role) OR public.has_role(auth.uid(), 'ADMIN'::app_role))
);
