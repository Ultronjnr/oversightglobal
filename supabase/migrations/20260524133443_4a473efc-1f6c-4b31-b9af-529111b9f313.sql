ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_target_check;
ALTER TABLE public.payment_allocations ADD CONSTRAINT payment_allocations_target_check
  CHECK (invoice_id IS NOT NULL OR reimbursement_id IS NOT NULL OR transaction_id IS NOT NULL);