-- Fix: enum status columns must be cast to text when calling log_transaction_event(text,...)
CREATE OR REPLACE FUNCTION public.tg_te_pr()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_transaction_event(NEW.id, NULL, NEW.organization_id, 'CREATED', 'Request Created', NULL, NEW.status::text, NULL, NEW.status::text);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'FINANCE_APPROVED' THEN _title := 'Approved by Finance'; _type := 'FINANCE_APPROVED';
    ELSIF NEW.status::text = 'FULFILLED' THEN _title := 'Request Fulfilled'; _type := 'PR_FULFILLED';
    ELSIF NEW.status::text = 'CLOSED' THEN _title := 'Request Closed'; _type := 'PR_CLOSED';
    ELSE _title := 'Status Updated'; _type := 'PR_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.id, NULL, NEW.organization_id, _type, _title, NULL, NEW.status::text, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_te_pr() FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.tg_te_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'FINANCE_APPROVED' THEN _title := 'Approved by Finance'; _type := 'FINANCE_APPROVED';
    ELSIF NEW.status::text = 'SUPPLIER_QUOTE' THEN _title := 'Quote Uploaded'; _type := 'QUOTE_UPLOADED';
    ELSIF NEW.status::text = 'QUOTE_ACCEPTED' THEN _title := 'Quote Accepted'; _type := 'QUOTE_ACCEPTED';
    ELSIF NEW.status::text IN ('SUPPLIER_INVOICE','INVOICED') THEN _title := 'Invoice Uploaded'; _type := 'INVOICE_UPLOADED';
    ELSIF NEW.status::text = 'AWAITING_PAYMENT' THEN _title := 'Invoice Approved'; _type := 'INVOICE_APPROVED';
    ELSIF NEW.status::text = 'PAYMENT_BATCH' THEN _title := 'Payment Batch Created'; _type := 'BATCH_CREATED';
    ELSIF NEW.status::text IN ('PAID','FULLY_PAID') THEN _title := 'Payment Completed'; _type := 'PAYMENT_COMPLETED';
    ELSIF NEW.status::text = 'COMPLETED' THEN _title := 'Completed'; _type := 'COMPLETED';
    ELSIF NEW.status::text = 'PARTIALLY_PAID' THEN _title := 'Partial Payment'; _type := 'TXN_PARTIAL';
    ELSE _title := 'Transaction Updated'; _type := 'TXN_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.pr_id, NEW.id, NEW.organization_id, _type, _title, NULL, NEW.status::text, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_te_transaction() FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.tg_te_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text; _txn uuid;
BEGIN
  _txn := COALESCE(NEW.transaction_id, (SELECT id FROM public.transactions WHERE pr_id = NEW.pr_id LIMIT 1));
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_transaction_event(NEW.pr_id, _txn, NEW.organization_id, 'INVOICE_UPLOADED', 'Invoice Uploaded', NULL, NEW.status::text, NULL, NEW.status::text);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'AWAITING_PAYMENT' THEN _title := 'Invoice Approved'; _type := 'INVOICE_APPROVED';
    ELSIF NEW.status::text = 'PAID' THEN _title := 'Invoice Paid'; _type := 'INVOICE_PAID';
    ELSIF NEW.status::text = 'PARTIALLY_PAID' THEN _title := 'Invoice Partially Paid'; _type := 'INVOICE_PARTIAL';
    ELSE _title := 'Invoice Updated'; _type := 'INVOICE_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.pr_id, _txn, NEW.organization_id, _type, _title, NULL, NEW.status::text, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_te_invoice() FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.tg_te_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text; _txn uuid;
BEGIN
  _txn := COALESCE(NEW.transaction_id, (SELECT id FROM public.transactions WHERE pr_id = NEW.pr_id LIMIT 1));
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_transaction_event(NEW.pr_id, _txn, NEW.organization_id, 'QUOTE_UPLOADED', 'Quote Uploaded', NULL, NEW.status::text, NULL, NEW.status::text);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'ACCEPTED' THEN _title := 'Quote Accepted'; _type := 'QUOTE_ACCEPTED';
    ELSIF NEW.status::text = 'REJECTED' THEN _title := 'Quote Rejected'; _type := 'QUOTE_REJECTED';
    ELSIF NEW.status::text = 'COMPLETED' THEN _title := 'Quote Completed'; _type := 'QUOTE_COMPLETED';
    ELSE _title := 'Quote Updated'; _type := 'QUOTE_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.pr_id, _txn, NEW.organization_id, _type, _title, NULL, NEW.status::text, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_te_quote() FROM anon, authenticated, public;