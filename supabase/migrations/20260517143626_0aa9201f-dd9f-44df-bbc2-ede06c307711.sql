-- 1. Title field
ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Standalone submit RPC (pr_id optional)
CREATE OR REPLACE FUNCTION public.submit_reimbursement(
  _title TEXT,
  _amount NUMERIC,
  _description TEXT,
  _payment_method TEXT,
  _proof_url TEXT,
  _pr_id UUID DEFAULT NULL,
  _reference TEXT DEFAULT NULL,
  _reimbursement_date DATE DEFAULT NULL,
  _notes TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _pr record;
  _reimb_id uuid;
  _employee_name text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF _proof_url IS NULL OR trim(_proof_url) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proof of payment is required');
  END IF;

  IF _title IS NULL OR trim(_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Title is required');
  END IF;

  IF _pr_id IS NOT NULL THEN
    SELECT * INTO _pr FROM public.purchase_requisitions WHERE id = _pr_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Linked requisition not found');
    END IF;
    IF _pr.requested_by <> _user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'You can only link to your own requisition');
    END IF;
    IF _amount > _pr.total_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Amount cannot exceed requisition total');
    END IF;
    _org_id := _pr.organization_id;
  ELSE
    SELECT organization_id INTO _org_id FROM public.profiles WHERE id = _user_id;
    IF _org_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No organization for user');
    END IF;
  END IF;

  SELECT COALESCE(name || ' ' || COALESCE(surname,''), email) INTO _employee_name
  FROM public.profiles WHERE id = _user_id;

  INSERT INTO public.reimbursements (
    organization_id, employee_id, employee_name, amount, description, title,
    proof_document_url, paid_by_employee, status, pr_id, payment_method,
    reimbursement_reference, reimbursement_date, notes
  ) VALUES (
    _org_id, _user_id, COALESCE(_employee_name,'Employee'), _amount, _description, trim(_title),
    _proof_url, true, 'PENDING', _pr_id, _payment_method,
    _reference, _reimbursement_date, _notes
  ) RETURNING id INTO _reimb_id;

  INSERT INTO public.reimbursement_audit_log (
    organization_id, reimbursement_id, action, new_status, performed_by, notes
  ) VALUES (
    _org_id, _reimb_id, 'SUBMITTED', 'PENDING', _user_id, _notes
  );

  RETURN jsonb_build_object('success', true, 'reimbursement_id', _reimb_id);
END;
$$;

-- 3. Internal comment RPC
CREATE OR REPLACE FUNCTION public.add_reimbursement_comment(
  _reimbursement_id UUID,
  _comment TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _r record;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (has_role(_user_id, 'FINANCE'::app_role) OR has_role(_user_id, 'ADMIN'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance or Admin can comment');
  END IF;
  IF _comment IS NULL OR trim(_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comment cannot be empty');
  END IF;

  _org_id := get_user_organization(_user_id);
  SELECT * INTO _r FROM public.reimbursements
  WHERE id = _reimbursement_id AND organization_id = _org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reimbursement not found');
  END IF;

  INSERT INTO public.reimbursement_audit_log (
    organization_id, reimbursement_id, action, performed_by, notes
  ) VALUES (
    _org_id, _reimbursement_id, 'COMMENT', _user_id, trim(_comment)
  );

  PERFORM public._notify_users(ARRAY[_r.employee_id], _org_id,
    'reimbursement_approved', 'Finance added a note',
    'Finance commented on your reimbursement.', _reimbursement_id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Allow employees to view their own reimbursement audit log
CREATE POLICY "Employees can view own reimbursement audit log"
ON public.reimbursement_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reimbursements r
    WHERE r.id = reimbursement_audit_log.reimbursement_id
      AND r.employee_id = auth.uid()
  )
);