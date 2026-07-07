-- =========================================================================
-- Phase 1: Backend cleanup — relationships & performance (reversible)
-- Single-transaction lifecycle is already enforced by
-- transactions_pr_id_key + ON CONFLICT (pr_id) DO UPDATE in both
-- tg_create_transaction_on_finance_approval and tg_invoice_fold_into_transaction.
-- This migration only fixes missing foreign keys and indexes.
-- =========================================================================

-- ---- 1. Clean orphaned links before enforcing foreign keys --------------
UPDATE public.attachments a
   SET pr_id = NULL
 WHERE pr_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.purchase_requisitions pr WHERE pr.id = a.pr_id);

UPDATE public.attachments a
   SET transaction_id = NULL
 WHERE transaction_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = a.transaction_id);

UPDATE public.attachments a
   SET reimbursement_id = NULL
 WHERE reimbursement_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.reimbursements r WHERE r.id = a.reimbursement_id);

UPDATE public.attachments a
   SET supplier_id = NULL
 WHERE supplier_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = a.supplier_id);

UPDATE public.receipts rc
   SET ocr_analysis_id = NULL
 WHERE ocr_analysis_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.ocr_analyses o WHERE o.id = rc.ocr_analysis_id);

-- ---- 2. Attachments foreign keys ----------------------------------------
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_pr_id_fkey
    FOREIGN KEY (pr_id) REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_reimbursement_id_fkey
    FOREIGN KEY (reimbursement_id) REFERENCES public.reimbursements(id) ON DELETE CASCADE;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- ---- 3. Receipts foreign key --------------------------------------------
ALTER TABLE public.receipts
  ADD CONSTRAINT receipts_ocr_analysis_id_fkey
    FOREIGN KEY (ocr_analysis_id) REFERENCES public.ocr_analyses(id) ON DELETE SET NULL;

-- ---- 4. Quotes indexes (joins/filters used by triggers & RPCs) ----------
CREATE INDEX IF NOT EXISTS idx_quotes_pr ON public.quotes (pr_id);
CREATE INDEX IF NOT EXISTS idx_quotes_supplier ON public.quotes (supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_request ON public.quotes (quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON public.quotes (organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_pr_status ON public.quotes (pr_id, status);

-- ---- 5. Invoices indexes ------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_pr ON public.invoices (pr_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON public.invoices (supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices (organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);

-- ---- 6. Attachments & receipts supporting index for new FK --------------
CREATE INDEX IF NOT EXISTS idx_receipts_ocr_analysis ON public.receipts (ocr_analysis_id);

-- ---- 7. PR messages composite index (hot polling path) ------------------
CREATE INDEX IF NOT EXISTS idx_pr_messages_pr_created ON public.pr_messages (pr_id, created_at);
