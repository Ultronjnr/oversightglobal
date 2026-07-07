-- =========================================================================
-- Transaction Timeline: append-only, immutable event log per transaction/PR
-- =========================================================================

CREATE TABLE public.transaction_events (
  id              uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pr_id           uuid REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  transaction_id  uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  title           text NOT NULL,
  comment         text,
  status          text,
  old_value       text,
  new_value       text,
  actor_id        uuid,
  actor_name      text,
  actor_role      text,
  created_at      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_txn_events_pr ON public.transaction_events (pr_id, created_at);
CREATE INDEX idx_txn_events_txn ON public.transaction_events (transaction_id, created_at);
CREATE INDEX idx_txn_events_org ON public.transaction_events (organization_id);

GRANT SELECT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;

ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

-- Read-only for users. Rows are inserted exclusively by SECURITY DEFINER
-- triggers (which bypass RLS), so no INSERT/UPDATE/DELETE policies exist:
-- the timeline is immutable from the client's perspective.
CREATE POLICY "Finance can view org timeline" ON public.transaction_events
  FOR SELECT USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'FINANCE'::app_role));
CREATE POLICY "Admin can view org timeline" ON public.transaction_events
  FOR SELECT USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));
CREATE POLICY "HOD can view org timeline" ON public.transaction_events
  FOR SELECT USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'HOD'::app_role));
CREATE POLICY "Employees can view own PR timeline" ON public.transaction_events
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_requisitions pr WHERE pr.id = transaction_events.pr_id AND pr.requested_by = auth.uid()));
CREATE POLICY "Suppliers can view related timeline" ON public.transaction_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.quotes q JOIN public.suppliers s ON s.id = q.supplier_id
    WHERE q.pr_id = transaction_events.pr_id AND s.user_id = auth.uid()
  ));

ALTER TABLE public.transaction_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_events;

-- ---- Central logging helper --------------------------------------------
CREATE OR REPLACE FUNCTION public.log_transaction_event(
  _pr_id uuid,
  _transaction_id uuid,
  _org_id uuid,
  _event_type text,
  _title text,
  _comment text DEFAULT NULL,
  _status text DEFAULT NULL,
  _old_value text DEFAULT NULL,
  _new_value text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _actor_name text;
  _role text;
  _txn uuid := _transaction_id;
  _pr uuid := _pr_id;
BEGIN
  IF _txn IS NULL AND _pr IS NOT NULL THEN
    SELECT id INTO _txn FROM public.transactions WHERE pr_id = _pr LIMIT 1;
  END IF;
  IF _pr IS NULL AND _txn IS NOT NULL THEN
    SELECT pr_id INTO _pr FROM public.transactions WHERE id = _txn;
  END IF;

  -- Nothing to attach the event to -> skip (avoids orphan rows)
  IF _pr IS NULL AND _txn IS NULL THEN
    RETURN;
  END IF;

  IF _uid IS NOT NULL THEN
    SELECT NULLIF(trim(COALESCE(name,'') || ' ' || COALESCE(surname,'')), '')
      INTO _actor_name FROM public.profiles WHERE id = _uid;
    BEGIN
      _role := public.get_user_role(_uid)::text;
    EXCEPTION WHEN OTHERS THEN _role := NULL;
    END;
  END IF;

  INSERT INTO public.transaction_events (
    organization_id, pr_id, transaction_id, event_type, title, comment,
    status, old_value, new_value, actor_id, actor_name, actor_role
  ) VALUES (
    _org_id, _pr, _txn, _event_type, _title, _comment,
    _status, _old_value, _new_value, _uid, COALESCE(_actor_name, 'System'), _role
  );
END;
$$;

-- ---- Trigger fns --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_te_pr()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_transaction_event(NEW.id, NULL, NEW.organization_id, 'CREATED', 'Request Created', NULL, NEW.status, NULL, NEW.status);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'FINANCE_APPROVED' THEN _title := 'Approved by Finance'; _type := 'FINANCE_APPROVED';
    ELSIF NEW.status = 'FULFILLED' THEN _title := 'Request Fulfilled'; _type := 'PR_FULFILLED';
    ELSIF NEW.status = 'CLOSED' THEN _title := 'Request Closed'; _type := 'PR_CLOSED';
    ELSE _title := 'Status Updated'; _type := 'PR_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.id, NULL, NEW.organization_id, _type, _title, NULL, NEW.status, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_te_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_transaction_event(NEW.pr_id, NULL, NEW.organization_id, 'QUOTE_UPLOADED', 'Quote Uploaded', NULL, NEW.status, NULL, NEW.status);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'ACCEPTED' THEN _title := 'Quote Accepted'; _type := 'QUOTE_ACCEPTED';
    ELSIF NEW.status = 'REJECTED' THEN _title := 'Quote Rejected'; _type := 'QUOTE_REJECTED';
    ELSIF NEW.status = 'COMPLETED' THEN _title := 'Quote Completed'; _type := 'QUOTE_COMPLETED';
    ELSE _title := 'Quote Updated'; _type := 'QUOTE_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.pr_id, NULL, NEW.organization_id, _type, _title, NULL, NEW.status, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_te_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_transaction_event(NEW.pr_id, NULL, NEW.organization_id, 'INVOICE_UPLOADED', 'Invoice Uploaded', NULL, NEW.status, NULL, NEW.status);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'AWAITING_PAYMENT' THEN _title := 'Invoice Approved'; _type := 'INVOICE_APPROVED';
    ELSIF NEW.status = 'PAID' THEN _title := 'Invoice Paid'; _type := 'INVOICE_PAID';
    ELSIF NEW.status = 'PARTIALLY_PAID' THEN _title := 'Invoice Partially Paid'; _type := 'INVOICE_PARTIAL';
    ELSE _title := 'Invoice Updated'; _type := 'INVOICE_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.pr_id, NULL, NEW.organization_id, _type, _title, NULL, NEW.status, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_te_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _type text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'INVOICED' THEN _title := 'Invoice Recorded'; _type := 'TXN_INVOICED';
    ELSIF NEW.status = 'PARTIALLY_PAID' THEN _title := 'Partial Payment'; _type := 'TXN_PARTIAL';
    ELSIF NEW.status = 'FULLY_PAID' THEN _title := 'Payment Completed'; _type := 'TXN_PAID';
    ELSE _title := 'Transaction Updated'; _type := 'TXN_STATUS';
    END IF;
    PERFORM public.log_transaction_event(NEW.pr_id, NEW.id, NEW.organization_id, _type, _title, NULL, NEW.status, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_te_allocation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _pr uuid; _txn uuid := NEW.transaction_id; _bn text;
BEGIN
  SELECT batch_number INTO _bn FROM public.payment_batches WHERE id = NEW.batch_id;
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT pr_id INTO _pr FROM public.invoices WHERE id = NEW.invoice_id;
  END IF;
  -- Only log allocations tied to a PR/transaction (skip reimbursements)
  IF _pr IS NULL AND _txn IS NULL THEN RETURN NEW; END IF;
  PERFORM public.log_transaction_event(_pr, _txn, NEW.organization_id, 'BATCH_CREATED', 'Payment Batch Created',
    CASE WHEN _bn IS NOT NULL THEN 'Added to batch ' || _bn ELSE NULL END, NULL, NULL, NEW.amount_paid::text);
  RETURN NEW;
END;
$$;

-- ---- Triggers -----------------------------------------------------------
CREATE TRIGGER trg_te_pr_ins AFTER INSERT ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_pr();
CREATE TRIGGER trg_te_pr_upd AFTER UPDATE OF status ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_pr();

CREATE TRIGGER trg_te_quote_ins AFTER INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_quote();
CREATE TRIGGER trg_te_quote_upd AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_quote();

CREATE TRIGGER trg_te_invoice_ins AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_invoice();
CREATE TRIGGER trg_te_invoice_upd AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_invoice();

CREATE TRIGGER trg_te_txn_upd AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_transaction();

CREATE TRIGGER trg_te_alloc_ins AFTER INSERT ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_allocation();

-- ---- Backfill "Created" events for existing transactions ----------------
INSERT INTO public.transaction_events (organization_id, pr_id, transaction_id, event_type, title, status, new_value, actor_name, created_at)
SELECT t.organization_id, t.pr_id, t.id, 'CREATED', 'Request Created', 'APPROVED_NOT_PAID', 'APPROVED_NOT_PAID', 'System', t.created_at
FROM public.transactions t;
