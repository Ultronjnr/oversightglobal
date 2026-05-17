-- OCR analyses table
CREATE TYPE public.ocr_document_type AS ENUM ('INVOICE', 'REIMBURSEMENT_PROOF', 'PR_DOCUMENT');
CREATE TYPE public.ocr_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE public.ocr_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type public.ocr_document_type NOT NULL,
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  reimbursement_id UUID REFERENCES public.reimbursements(id) ON DELETE CASCADE,
  pr_id UUID REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  status public.ocr_status NOT NULL DEFAULT 'PENDING',
  model TEXT,
  extracted JSONB,
  confidence NUMERIC,
  raw_text TEXT,
  error_message TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_analyses_org ON public.ocr_analyses(organization_id);
CREATE INDEX idx_ocr_analyses_invoice ON public.ocr_analyses(invoice_id);
CREATE INDEX idx_ocr_analyses_reimbursement ON public.ocr_analyses(reimbursement_id);
CREATE INDEX idx_ocr_analyses_pr ON public.ocr_analyses(pr_id);

ALTER TABLE public.ocr_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view OCR analyses"
ON public.ocr_analyses FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Org Finance/Admin can insert OCR analyses"
ON public.ocr_analyses FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'ADMIN'::app_role)
       OR public.has_role(auth.uid(), 'FINANCE'::app_role)
       OR public.has_role(auth.uid(), 'EMPLOYEE'::app_role))
);

CREATE POLICY "Org Finance/Admin can update OCR analyses"
ON public.ocr_analyses FOR UPDATE
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'ADMIN'::app_role)
       OR public.has_role(auth.uid(), 'FINANCE'::app_role))
);

CREATE TRIGGER update_ocr_analyses_updated_at
BEFORE UPDATE ON public.ocr_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();