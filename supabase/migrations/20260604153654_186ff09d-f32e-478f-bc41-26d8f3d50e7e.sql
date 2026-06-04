-- Stage 1: Finance approval moves PENDING -> APPROVED (awaiting admin final approval)
CREATE OR REPLACE FUNCTION public.approve_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can approve reimbursements');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement is not pending');
  END IF;

  UPDATE public.reimbursements
  SET status = 'APPROVED', approved_by = _user_id, approved_at = now(), updated_at = now()
  WHERE id = _reimbursement_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'FINANCE_APPROVED', 'PENDING', 'APPROVED', _user_id, _notes);

  -- Notify Admin that a final approval is required
  PERFORM public._notify_role('ADMIN', _org_id,
    'reimbursement_submitted', 'Reimbursement needs final approval',
    _r.employee_name || '''s reimbursement of ' || _r.currency || ' ' || _r.amount || ' was approved by Finance and needs your final approval.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Stage 2: Admin final approval moves APPROVED -> AWAITING_PAYMENT
CREATE OR REPLACE FUNCTION public.admin_approve_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF NOT has_role(_user_id, 'ADMIN'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Admin can give final approval');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text <> 'APPROVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement is not awaiting final approval');
  END IF;

  UPDATE public.reimbursements
  SET status = 'AWAITING_PAYMENT', updated_at = now()
  WHERE id = _reimbursement_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'ADMIN_FINAL_APPROVED', 'APPROVED', 'AWAITING_PAYMENT', _user_id, _notes);

  -- Notify employee + Finance that it's cleared for payment
  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'reimbursement_approved', 'Reimbursement approved',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' received final approval and is awaiting payment.', _r.id::text);
  PERFORM public._notify_role('FINANCE', _org_id,
    'reimbursement_approved', 'Reimbursement cleared for payment',
    _r.employee_name || '''s reimbursement of ' || _r.currency || ' ' || _r.amount || ' received final approval and can be paid.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Decline: allow Finance or Admin, from PENDING or APPROVED
CREATE OR REPLACE FUNCTION public.reject_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF NOT (has_role(_user_id, 'FINANCE'::app_role) OR has_role(_user_id, 'ADMIN'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance or Admin can decline reimbursements');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text NOT IN ('PENDING','APPROVED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement cannot be declined at this stage');
  END IF;

  UPDATE public.reimbursements
  SET status = 'REJECTED', approved_by = _user_id, approved_at = now(), updated_at = now(), notes = COALESCE(_notes, notes)
  WHERE id = _reimbursement_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'REJECTED', _r.status::text, 'REJECTED', _user_id, _notes);

  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'reimbursement_approved', 'Reimbursement rejected',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' was rejected.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Mark paid: allow Finance or Admin, only after Admin final approval (AWAITING_PAYMENT)
CREATE OR REPLACE FUNCTION public.mark_reimbursement_paid(_reimbursement_id uuid, _payment_reference text DEFAULT NULL::text, _payment_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF NOT (has_role(_user_id, 'FINANCE'::app_role) OR has_role(_user_id, 'ADMIN'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance or Admin can mark reimbursements as paid');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text <> 'AWAITING_PAYMENT' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement must receive final approval before payment');
  END IF;

  UPDATE public.reimbursements
  SET status = 'PAID', paid_at = now(), updated_at = now(),
      reimbursement_reference = COALESCE(_payment_reference, reimbursement_reference),
      reimbursement_date = COALESCE(_payment_date, reimbursement_date, CURRENT_DATE)
  WHERE id = _reimbursement_id;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'PAID', _r.status::text, 'PAID', _user_id, _payment_reference);

  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'full_payment', 'Reimbursement paid',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' has been paid.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Simplify notification trigger to only fire on INSERT (status-change notifications handled in RPCs)
CREATE OR REPLACE FUNCTION public.tg_reimbursement_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._notify_role('FINANCE', NEW.organization_id, 'reimbursement_submitted',
      'New reimbursement request',
      NEW.employee_name || ' submitted a reimbursement of ' || NEW.currency || ' ' || NEW.amount, NEW.id::text);
    PERFORM public._notify_role('ADMIN', NEW.organization_id, 'reimbursement_submitted',
      'New reimbursement request',
      NEW.employee_name || ' submitted a reimbursement of ' || NEW.currency || ' ' || NEW.amount, NEW.id::text);
  END IF;
  RETURN NEW;
END $function$;

GRANT EXECUTE ON FUNCTION public.admin_approve_reimbursement(uuid, text) TO authenticated;