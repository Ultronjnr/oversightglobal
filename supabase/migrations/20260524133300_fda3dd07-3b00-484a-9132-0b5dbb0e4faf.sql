ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_reimbursement_id_fkey
  FOREIGN KEY (reimbursement_id) REFERENCES public.reimbursements(id) ON DELETE SET NULL;