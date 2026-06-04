-- Helper: notify a supplier by supplier_id
CREATE OR REPLACE FUNCTION public._notify_supplier(_supplier_id uuid, _org_id uuid, _type notification_type, _title text, _message text, _related text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid;
BEGIN
  SELECT user_id INTO _uid FROM public.suppliers WHERE id = _supplier_id;
  IF _uid IS NULL THEN
    RETURN;
  END IF;
  PERFORM public._notify_users(ARRAY[_uid], _org_id, _type, _title, _message, _related);
END $function$;

-- New quote request invitation -> notify supplier
CREATE OR REPLACE FUNCTION public.tg_quote_request_supplier_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _txn text;
BEGIN
  SELECT transaction_id INTO _txn FROM public.purchase_requisitions WHERE id = NEW.pr_id;
  PERFORM public._notify_supplier(NEW.supplier_id, NEW.organization_id, 'quote_request_received',
    'New quote request',
    'You received a new quote request for ' || COALESCE(_txn,'a purchase') || '.', _txn);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_quote_request_supplier_notify ON public.quote_requests;
CREATE TRIGGER trg_quote_request_supplier_notify
AFTER INSERT ON public.quote_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_quote_request_supplier_notify();

-- Quote accepted -> notify supplier to upload invoice
CREATE OR REPLACE FUNCTION public.tg_quote_accepted_supplier_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _txn text;
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED' THEN
    SELECT transaction_id INTO _txn FROM public.purchase_requisitions WHERE id = NEW.pr_id;
    PERFORM public._notify_supplier(NEW.supplier_id, NEW.organization_id, 'quote_accepted',
      'Quote accepted',
      'Your quote for ' || COALESCE(_txn,'a purchase') || ' was accepted. Please upload your invoice.', _txn);
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_quote_accepted_supplier_notify ON public.quotes;
CREATE TRIGGER trg_quote_accepted_supplier_notify
AFTER UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_quote_accepted_supplier_notify();

-- Full payment -> notify supplier
CREATE OR REPLACE FUNCTION public.tg_payment_supplier_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _quote_amount numeric;
  _paid numeric;
  _supplier_id uuid;
  _txn text;
BEGIN
  IF NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT q.amount, i.supplier_id, pr.transaction_id
    INTO _quote_amount, _supplier_id, _txn
  FROM public.invoices i
  JOIN public.quotes q ON q.id = i.quote_id
  JOIN public.purchase_requisitions pr ON pr.id = i.pr_id
  WHERE i.id = NEW.invoice_id;

  SELECT COALESCE(SUM(amount_paid),0) INTO _paid
  FROM public.payment_allocations WHERE invoice_id = NEW.invoice_id;

  IF _paid >= COALESCE(_quote_amount,0) AND _supplier_id IS NOT NULL THEN
    PERFORM public._notify_supplier(_supplier_id, NEW.organization_id, 'full_payment',
      'Payment completed',
      'Your invoice for ' || COALESCE(_txn,'a purchase') || ' has been paid in full.', _txn);
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_payment_supplier_notify ON public.payment_allocations;
CREATE TRIGGER trg_payment_supplier_notify
AFTER INSERT ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.tg_payment_supplier_notify();