-- Fix: PRs were being locked immediately on creation because a trigger on
-- transactions marked pr_locked=true whenever a transaction referencing the
-- PR was inserted. The PR-ensure-transaction trigger creates a transaction
-- at PR insert time, which caused every new PR to disappear from the
-- Finance "Incoming Purchase Requisitions" queue.
--
-- Reconciliation on invoice receipt is already handled by
-- tg_invoice_lock_pr (trg_invoice_lock_pr_on_insert on invoices), so this
-- transaction-side lock is redundant and incorrect.

DROP TRIGGER IF EXISTS trg_lock_pr_on_txn ON public.transactions;
DROP TRIGGER IF EXISTS trg_lock_pr_on_invoice ON public.invoices;

-- Unlock existing PRs that were incorrectly locked while still pending
-- finance review so they show up in the incoming queue again.
UPDATE public.purchase_requisitions
   SET pr_locked = false
 WHERE pr_locked = true
   AND status = 'PENDING_FINANCE_APPROVAL'
   AND NOT EXISTS (
     SELECT 1 FROM public.invoices i WHERE i.pr_id = purchase_requisitions.id
   );