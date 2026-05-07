
-- Notification type enum
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'requisition_submitted',
    'requisition_approved',
    'requisition_declined',
    'reimbursement_submitted',
    'reimbursement_approved',
    'partial_payment',
    'full_payment',
    'batch_created',
    'overdue_transaction',
    'invoice_uploaded',
    'ai_receipt_matched'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type public.notification_type NOT NULL,
  related_transaction_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

-- Helper: insert notifications for a list of user IDs
CREATE OR REPLACE FUNCTION public._notify_users(
  _user_ids uuid[],
  _org_id uuid,
  _type public.notification_type,
  _title text,
  _message text,
  _related text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, organization_id, title, message, type, related_transaction_id)
  SELECT DISTINCT u, _org_id, _title, _message, _type, _related
  FROM unnest(_user_ids) u
  WHERE u IS NOT NULL;
END $$;

-- Helper: fan out to all users in org with a given role
CREATE OR REPLACE FUNCTION public._notify_role(
  _role public.app_role,
  _org_id uuid,
  _type public.notification_type,
  _title text,
  _message text,
  _related text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ids uuid[];
BEGIN
  SELECT array_agg(p.id)
  INTO _ids
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.organization_id = _org_id
    AND ur.role = _role
    AND p.status = 'ACTIVE';
  PERFORM public._notify_users(_ids, _org_id, _type, _title, _message, _related);
END $$;

-- Trigger: PR submitted / approved / declined
CREATE OR REPLACE FUNCTION public.tg_pr_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._notify_role('ADMIN', NEW.organization_id, 'requisition_submitted',
      'New requisition submitted',
      NEW.requested_by_name || ' submitted ' || NEW.transaction_id, NEW.transaction_id);
    PERFORM public._notify_role('HOD', NEW.organization_id, 'requisition_submitted',
      'Requisition awaiting your approval',
      NEW.requested_by_name || ' submitted ' || NEW.transaction_id, NEW.transaction_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'FINANCE_APPROVED' THEN
      PERFORM public._notify_users(ARRAY[NEW.requested_by], NEW.organization_id,
        'requisition_approved', 'Requisition approved',
        'Your requisition ' || NEW.transaction_id || ' was approved.', NEW.transaction_id);
    ELSIF NEW.status IN ('FINANCE_DECLINED','HOD_DECLINED') THEN
      PERFORM public._notify_users(ARRAY[NEW.requested_by], NEW.organization_id,
        'requisition_declined', 'Requisition declined',
        'Your requisition ' || NEW.transaction_id || ' was declined.', NEW.transaction_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pr_notifications_trg ON public.purchase_requisitions;
CREATE TRIGGER pr_notifications_trg
AFTER INSERT OR UPDATE ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_pr_notifications();

-- Trigger: reimbursements
CREATE OR REPLACE FUNCTION public.tg_reimbursement_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._notify_role('FINANCE', NEW.organization_id, 'reimbursement_submitted',
      'New reimbursement request',
      NEW.employee_name || ' submitted a reimbursement of ' || NEW.currency || ' ' || NEW.amount, NEW.id::text);
    PERFORM public._notify_role('ADMIN', NEW.organization_id, 'reimbursement_submitted',
      'New reimbursement request',
      NEW.employee_name || ' submitted a reimbursement of ' || NEW.currency || ' ' || NEW.amount, NEW.id::text);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text = 'APPROVED' THEN
    PERFORM public._notify_users(ARRAY[NEW.employee_id], NEW.organization_id,
      'reimbursement_approved', 'Reimbursement approved',
      'Your reimbursement of ' || NEW.currency || ' ' || NEW.amount || ' was approved.', NEW.id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reimbursement_notifications_trg ON public.reimbursements;
CREATE TRIGGER reimbursement_notifications_trg
AFTER INSERT OR UPDATE ON public.reimbursements
FOR EACH ROW EXECUTE FUNCTION public.tg_reimbursement_notifications();

-- Trigger: invoices uploaded
CREATE OR REPLACE FUNCTION public.tg_invoice_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _txn text;
BEGIN
  SELECT transaction_id INTO _txn FROM public.purchase_requisitions WHERE id = NEW.pr_id;
  PERFORM public._notify_role('FINANCE', NEW.organization_id, 'invoice_uploaded',
    'Invoice uploaded', 'Supplier uploaded an invoice for ' || COALESCE(_txn,'a PR'), _txn);
  PERFORM public._notify_role('ADMIN', NEW.organization_id, 'invoice_uploaded',
    'Invoice uploaded', 'Supplier uploaded an invoice for ' || COALESCE(_txn,'a PR'), _txn);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invoice_notifications_trg ON public.invoices;
CREATE TRIGGER invoice_notifications_trg
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_notifications();

-- Trigger: payment allocations -> partial / full
CREATE OR REPLACE FUNCTION public.tg_payment_alloc_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _quote_amount numeric;
  _paid numeric;
  _txn text;
  _requester uuid;
  _is_full boolean;
  _type public.notification_type;
  _title text;
  _msg text;
BEGIN
  SELECT q.amount, pr.transaction_id, pr.requested_by
    INTO _quote_amount, _txn, _requester
  FROM public.invoices i
  JOIN public.quotes q ON q.id = i.quote_id
  JOIN public.purchase_requisitions pr ON pr.id = i.pr_id
  WHERE i.id = NEW.invoice_id;

  SELECT COALESCE(SUM(amount_paid),0) INTO _paid
  FROM public.payment_allocations WHERE invoice_id = NEW.invoice_id;

  _is_full := _paid >= COALESCE(_quote_amount, 0);
  IF _is_full THEN
    _type := 'full_payment';
    _title := 'Payment completed';
    _msg := 'Invoice for ' || COALESCE(_txn,'a PR') || ' has been fully paid.';
  ELSE
    _type := 'partial_payment';
    _title := 'Partial payment processed';
    _msg := 'A partial payment of ' || NEW.amount_paid || ' was applied to ' || COALESCE(_txn,'a PR') || '.';
  END IF;

  PERFORM public._notify_role('FINANCE', NEW.organization_id, _type, _title, _msg, _txn);
  PERFORM public._notify_role('ADMIN', NEW.organization_id, _type, _title, _msg, _txn);
  IF _requester IS NOT NULL THEN
    PERFORM public._notify_users(ARRAY[_requester], NEW.organization_id, _type, _title, _msg, _txn);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_alloc_notifications_trg ON public.payment_allocations;
CREATE TRIGGER payment_alloc_notifications_trg
AFTER INSERT ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.tg_payment_alloc_notifications();

-- Trigger: batch created
CREATE OR REPLACE FUNCTION public.tg_batch_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._notify_role('FINANCE', NEW.organization_id, 'batch_created',
    'Payment batch created',
    'A new payment batch of ' || NEW.currency || ' ' || NEW.total_amount || ' was created.', NEW.id::text);
  PERFORM public._notify_role('ADMIN', NEW.organization_id, 'batch_created',
    'Payment batch created',
    'A new payment batch of ' || NEW.currency || ' ' || NEW.total_amount || ' was created.', NEW.id::text);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS batch_notifications_trg ON public.payment_batches;
CREATE TRIGGER batch_notifications_trg
AFTER INSERT ON public.payment_batches
FOR EACH ROW EXECUTE FUNCTION public.tg_batch_notifications();
