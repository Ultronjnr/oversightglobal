
CREATE OR REPLACE FUNCTION public.tg_pr_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._notify_role('ADMIN', NEW.organization_id, 'requisition_submitted',
      'New requisition submitted',
      NEW.requested_by_name || ' submitted ' || NEW.transaction_id, NEW.transaction_id);

    IF NEW.status = 'PENDING_HOD_APPROVAL' THEN
      PERFORM public._notify_role('HOD', NEW.organization_id, 'requisition_submitted',
        'Requisition awaiting your approval',
        NEW.requested_by_name || ' submitted ' || NEW.transaction_id, NEW.transaction_id);
    ELSIF NEW.status = 'PENDING_FINANCE_APPROVAL' THEN
      PERFORM public._notify_role('FINANCE', NEW.organization_id, 'requisition_submitted',
        'Requisition awaiting Finance approval',
        NEW.requested_by_name || ' submitted ' || NEW.transaction_id, NEW.transaction_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'PENDING_FINANCE_APPROVAL' THEN
      PERFORM public._notify_role('FINANCE', NEW.organization_id, 'requisition_submitted',
        'Requisition awaiting Finance approval',
        NEW.requested_by_name || '''s requisition ' || NEW.transaction_id || ' is ready for Finance review.', NEW.transaction_id);
    ELSIF NEW.status = 'FINANCE_APPROVED' THEN
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
END $function$;
