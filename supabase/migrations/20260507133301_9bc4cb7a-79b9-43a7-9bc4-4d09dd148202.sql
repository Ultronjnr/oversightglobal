
-- Reimbursement status enum
CREATE TYPE public.reimbursement_status AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'PAID');

-- Reimbursements table
CREATE TABLE public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  description TEXT NOT NULL,
  proof_document_url TEXT,
  status public.reimbursement_status NOT NULL DEFAULT 'PENDING',
  paid_by_employee BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reimbursements_org ON public.reimbursements(organization_id);
CREATE INDEX idx_reimbursements_employee ON public.reimbursements(employee_id);
CREATE INDEX idx_reimbursements_status ON public.reimbursements(status);

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

-- Employees: create + view own
CREATE POLICY "Employees can create own reimbursements"
  ON public.reimbursements FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    AND employee_id = auth.uid()
  );

CREATE POLICY "Employees can view own reimbursements"
  ON public.reimbursements FOR SELECT
  USING (employee_id = auth.uid());

-- Finance: view + update all in org
CREATE POLICY "Finance can view org reimbursements"
  ON public.reimbursements FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

CREATE POLICY "Finance can update org reimbursements"
  ON public.reimbursements FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));

-- Admin: view + update all in org
CREATE POLICY "Admin can view org reimbursements"
  ON public.reimbursements FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admin can update org reimbursements"
  ON public.reimbursements FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER update_reimbursements_updated_at
  BEFORE UPDATE ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for proof documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('reimbursement-documents', 'reimbursement-documents', false);

-- Storage policies: employees upload to their own folder; finance/admin can view org docs
CREATE POLICY "Employees upload own reimbursement proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reimbursement-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Employees view own reimbursement proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Finance can view all reimbursement proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-documents'
    AND has_role(auth.uid(), 'FINANCE'::app_role)
  );

CREATE POLICY "Admin can view all reimbursement proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-documents'
    AND has_role(auth.uid(), 'ADMIN'::app_role)
  );
