CREATE OR REPLACE FUNCTION public.admin_approve_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF NOT public.can_act_as_finance(_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can give final approval');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _r FROM public.reimbursements WHERE id = _reimbursement_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found'); END IF;
  IF _r.status::text <> 'APPROVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement is not awaiting final approval');
  END IF;

  UPDATE public.reimbursements SET status = 'AWAITING_PAYMENT', updated_at = now() WHERE id = _reimbursement_id;

  IF _r.pr_id IS NOT NULL THEN
    UPDATE public.transactions t
    SET status = 'COMPLETED', amount_paid = t.amount, paid_at = COALESCE(t.paid_at, now()), updated_at = now()
    WHERE t.pr_id = _r.pr_id AND t.organization_id = _org_id AND t.status NOT IN ('COMPLETED','CANCELLED');

    INSERT INTO public.payment_audit_log (organization_id, transaction_id, action, new_status, amount, performed_by, notes)
    SELECT _org_id, t.id, 'SETTLED_BY_EMPLOYEE', 'COMPLETED', t.amount, _user_id,
           'Paid directly by employee; reimbursement ' || _reimbursement_id::text || ' queued for payout'
    FROM public.transactions t WHERE t.pr_id = _r.pr_id AND t.organization_id = _org_id;
  END IF;

  INSERT INTO public.reimbursement_audit_log (organization_id, reimbursement_id, action, old_status, new_status, performed_by, notes)
  VALUES (_org_id, _reimbursement_id, 'FINANCE_FINAL_APPROVED', 'APPROVED', 'AWAITING_PAYMENT', _user_id, _notes);

  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'reimbursement_approved', 'Reimbursement approved',
    'Your reimbursement of ' || _r.currency || ' ' || _r.amount || ' received final approval from Finance and is awaiting payment.', _r.id::text);

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_reimbursement(_reimbursement_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF NOT public.can_act_as_finance(_user_id) THEN
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

  -- Finance holds final approval: move straight to the payment queue.
  RETURN public.admin_approve_reimbursement(_reimbursement_id, _notes);
END;
$function$;