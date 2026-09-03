-- ============ Tables ============
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

CREATE TABLE public.user_approval_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  approval_type text NOT NULL,
  max_amount numeric(14,2),
  currency text NOT NULL DEFAULT 'ZAR',
  unlimited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, approval_type)
);

CREATE TABLE public.permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  target_user_id uuid NOT NULL,
  change_type text NOT NULL,
  subject text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_approval_limits TO authenticated;
GRANT SELECT, INSERT ON public.permission_audit_log TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
GRANT ALL ON public.user_approval_limits TO service_role;
GRANT ALL ON public.permission_audit_log TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_approval_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

-- ============ Role defaults ============
CREATE OR REPLACE FUNCTION public.default_role_permission(_role public.app_role, _permission text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _role = 'ADMIN' THEN true
    WHEN _role = 'FINANCE' THEN _permission NOT IN (
      'users.invite','users.edit','users.manage_permissions'
    )
    WHEN _role = 'HOD' THEN _permission IN (
      'requisitions.view','requisitions.create','requisitions.edit','requisitions.submit',
      'requisitions.approve','requisitions.decline',
      'transactions.view','expenses.view','expenses.create',
      'invoices.view','invoices.upload',
      'suppliers.view','projects.view','donors.view',
      'reports.view','reports.export','users.view'
    )
    WHEN _role = 'EMPLOYEE' THEN _permission IN (
      'requisitions.view','requisitions.create','requisitions.edit','requisitions.submit',
      'expenses.view','expenses.create','invoices.view','invoices.upload',
      'suppliers.view','projects.view','donors.view'
    )
    WHEN _role = 'SUPPLIER' THEN _permission IN (
      'invoices.view','invoices.upload','suppliers.view'
    )
    ELSE false
  END;
$$;

-- ============ Effective permission ============
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _override boolean;
  _allowed boolean := false;
  _r public.app_role;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  -- Super User always has full access
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ADMIN') THEN
    RETURN true;
  END IF;

  SELECT allowed INTO _override
  FROM public.user_permissions
  WHERE user_id = _user_id AND permission_key = _permission;

  IF _override IS NOT NULL THEN
    RETURN _override;
  END IF;

  FOR _r IN SELECT role FROM public.user_roles WHERE user_id = _user_id LOOP
    IF public.default_role_permission(_r, _permission) THEN
      _allowed := true;
    END IF;
  END LOOP;

  RETURN _allowed;
END;
$$;

-- ============ Approval limit check ============
CREATE OR REPLACE FUNCTION public.can_approve_amount(_user_id uuid, _approval_type text, _amount numeric)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim public.user_approval_limits%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  -- Super User is unrestricted
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ADMIN') THEN
    RETURN true;
  END IF;

  SELECT * INTO _lim
  FROM public.user_approval_limits
  WHERE user_id = _user_id AND approval_type = _approval_type;

  IF NOT FOUND THEN RETURN true; END IF;          -- no limit configured
  IF _lim.unlimited THEN RETURN true; END IF;
  IF _lim.max_amount IS NULL THEN RETURN true; END IF;

  RETURN COALESCE(_amount, 0) <= _lim.max_amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.default_role_permission(public.app_role, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_approve_amount(uuid, text, numeric) FROM anon;

-- ============ RLS policies ============
CREATE POLICY "read own or super user reads org permissions"
ON public.user_permissions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (organization_id = public.get_user_organization(auth.uid())
      AND public.has_role(auth.uid(), 'ADMIN'))
);

CREATE POLICY "super users manage org permissions"
ON public.user_permissions FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "read own or super user reads org limits"
ON public.user_approval_limits FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (organization_id = public.get_user_organization(auth.uid())
      AND public.has_role(auth.uid(), 'ADMIN'))
);

CREATE POLICY "super users manage org limits"
ON public.user_approval_limits FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "super users read permission audit"
ON public.permission_audit_log FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "super users write permission audit"
ON public.permission_audit_log FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND changed_by = auth.uid()
  AND public.has_role(auth.uid(), 'ADMIN')
);

-- ============ Server-side enforcement: requisition approvals ============
CREATE OR REPLACE FUNCTION public.tg_enforce_pr_approval_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;             -- service role / internal jobs
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status IN ('HOD_APPROVED','PENDING_FINANCE_APPROVAL','FINANCE_APPROVED') THEN
    IF NOT public.has_permission(_uid, 'requisitions.approve') THEN
      RAISE EXCEPTION 'You do not have permission to approve requisitions.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_approve_amount(_uid, 'REQUISITION', NEW.total_amount) THEN
      RAISE EXCEPTION 'This amount exceeds your approval authority. Please escalate to a supervisor.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status IN ('HOD_DECLINED','FINANCE_DECLINED') THEN
    IF NOT public.has_permission(_uid, 'requisitions.decline') THEN
      RAISE EXCEPTION 'You do not have permission to decline requisitions.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_pr_approval_permissions
BEFORE UPDATE ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_pr_approval_permissions();

-- ============ Server-side enforcement: reimbursement approvals ============
CREATE OR REPLACE FUNCTION public.tg_enforce_reimbursement_approval_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status IN ('APPROVED','AWAITING_PAYMENT') THEN
    IF NOT public.has_permission(_uid, 'transactions.approve') THEN
      RAISE EXCEPTION 'You do not have permission to approve reimbursements.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_approve_amount(_uid, 'REIMBURSEMENT', NEW.amount) THEN
      RAISE EXCEPTION 'This amount exceeds your approval authority. Please escalate to a supervisor.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_reimbursement_approval_permissions
BEFORE UPDATE ON public.reimbursements
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_reimbursement_approval_permissions();