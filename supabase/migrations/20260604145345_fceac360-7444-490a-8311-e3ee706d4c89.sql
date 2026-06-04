-- Quote submitted notifications
CREATE OR REPLACE FUNCTION public.tg_quote_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _txn text;
  _supplier text;
BEGIN
  SELECT pr.transaction_id INTO _txn FROM public.purchase_requisitions pr WHERE pr.id = NEW.pr_id;
  SELECT s.company_name INTO _supplier FROM public.suppliers s WHERE s.id = NEW.supplier_id;
  PERFORM public._notify_role('FINANCE', NEW.organization_id, 'quote_submitted',
    'New quote received',
    COALESCE(_supplier,'A supplier') || ' submitted a quote for ' || COALESCE(_txn,'a PR') || '.', _txn);
  PERFORM public._notify_role('ADMIN', NEW.organization_id, 'quote_submitted',
    'New quote received',
    COALESCE(_supplier,'A supplier') || ' submitted a quote for ' || COALESCE(_txn,'a PR') || '.', _txn);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_quote_notifications ON public.quotes;
CREATE TRIGGER trg_quote_notifications
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_quote_notifications();

-- Invoice uploaded notifications (function already exists)
DROP TRIGGER IF EXISTS trg_invoice_notifications ON public.invoices;
CREATE TRIGGER trg_invoice_notifications
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_notifications();

-- Payment batch created notifications
CREATE OR REPLACE FUNCTION public.tg_batch_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._notify_role('FINANCE', NEW.organization_id, 'batch_created',
    'Payment batch created',
    'Payment batch ' || COALESCE(NEW.batch_number,'') || ' was created.', NEW.id::text);
  PERFORM public._notify_role('ADMIN', NEW.organization_id, 'batch_created',
    'Payment batch created',
    'Payment batch ' || COALESCE(NEW.batch_number,'') || ' was created.', NEW.id::text);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_batch_notifications ON public.payment_batches;
CREATE TRIGGER trg_batch_notifications
AFTER INSERT ON public.payment_batches
FOR EACH ROW EXECUTE FUNCTION public.tg_batch_notifications();