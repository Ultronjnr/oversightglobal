-- 1. Extend attachment kinds to support the full document set
ALTER TYPE public.attachment_kind ADD VALUE IF NOT EXISTS 'QUOTE';
ALTER TYPE public.attachment_kind ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';
ALTER TYPE public.attachment_kind ADD VALUE IF NOT EXISTS 'SUPPORTING';

-- 2. Version-history / replacement support on attachments
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- 3. Indexes to keep attachment lookups fast and never orphaned
CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON public.attachments(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_pr ON public.attachments(pr_id) WHERE pr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_reimbursement ON public.attachments(reimbursement_id) WHERE reimbursement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_supplier ON public.attachments(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_current ON public.attachments(is_current);
CREATE INDEX IF NOT EXISTS idx_attachments_supersedes ON public.attachments(supersedes_id) WHERE supersedes_id IS NOT NULL;

-- 4. Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_attachments_updated_at ON public.attachments;
CREATE TRIGGER update_attachments_updated_at
BEFORE UPDATE ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();