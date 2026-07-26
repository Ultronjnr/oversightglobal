CREATE OR REPLACE FUNCTION public.tg_invoice_lock_pr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.purchase_requisitions
     SET status = CASE
       WHEN status IN ('FULFILLED','CLOSED') THEN status
       ELSE 'FINANCE_APPROVED'::pr_status
     END,
     pr_locked = true,
     updated_at = now()
   WHERE id = NEW.pr_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_notifications_trg ON public.invoices;