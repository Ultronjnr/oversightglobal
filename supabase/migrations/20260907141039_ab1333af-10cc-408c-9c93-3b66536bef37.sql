-- ============ Expiry support ============
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.user_approval_limits ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.user_approval_limits ADD COLUMN IF NOT EXISTS max_approvals_per_month integer;

-- ============ Reporting hierarchy ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reports_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============ Scope restrictions ============
CREATE TABLE IF NOT EXISTS public.user_permission_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('PROJECT','DONOR','DEPARTMENT','EXPENSE_TYPE')),
  scope_value text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope_type, scope_value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_scopes TO authenticated;
GRANT ALL ON public.user_permission_scopes TO service_role;
ALTER TABLE public.user_permission_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or super user reads org scopes"
ON public.user_permission_scopes FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (organization_id = public.get_user_organization(auth.uid())
      AND public.has_role(auth.uid(), 'ADMIN'))
);

CREATE POLICY "super users manage org scopes"
ON public.user_permission_scopes FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'));

-- ============ Approval audit trail ============
CREATE TABLE IF NOT EXISTS public.approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  approver_id uuid NOT NULL,
  approval_type text NOT NULL,
  entity_id uuid,
  entity_status text,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_events_user_month
  ON public.approval_events (approver_id, approval_type, created_at);
CREATE INDEX IF NOT EXISTS idx_approval_events_entity
  ON public.approval_events (entity_id);

GRANT SELECT ON public.approval_events TO authenticated;
GRANT ALL ON public.approval_events TO service_role;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read approval events"
ON public.approval_events FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

-- ============ Effective permission honours expiry ============
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

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ADMIN') THEN
    RETURN true;
  END IF;

  SELECT allowed INTO _override
  FROM public.user_permissions
  WHERE user_id = _user_id
    AND permission_key = _permission
    AND (expires_at IS NULL OR expires_at > now());

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

-- ============ Scope check ============
CREATE OR REPLACE FUNCTION public.user_scope_allowed(_user_id uuid, _scope_type text, _scope_value text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_any boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ADMIN') THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_permission_scopes
    WHERE user_id = _user_id AND scope_type = _scope_type
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO _has_any;

  IF NOT _has_any THEN RETURN true; END IF;   -- unrestricted
  IF _scope_value IS NULL THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_permission_scopes
    WHERE user_id = _user_id AND scope_type = _scope_type
      AND scope_value = _scope_value
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- ============ Approval limit: amount, expiry and monthly count ============
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

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ADMIN') THEN
    RETURN true;
  END IF;

  SELECT * INTO _lim
  FROM public.user_approval_limits
  WHERE user_id = _user_id AND approval_type = _approval_type;

  IF NOT FOUND THEN RETURN true; END IF;
  IF _lim.expires_at IS NOT NULL AND _lim.expires_at <= now() THEN RETURN true; END IF;

  IF _lim.max_approvals_per_month IS NOT NULL THEN
    IF (
      SELECT count(*) FROM public.approval_events
      WHERE approver_id = _user_id
        AND approval_type = _approval_type
        AND created_at >= date_trunc('month', now())
    ) >= _lim.max_approvals_per_month THEN
      RETURN false;
    END IF;
  END IF;

  IF _lim.unlimited THEN RETURN true; END IF;
  IF _lim.max_amount IS NULL THEN RETURN true; END IF;

  RETURN COALESCE(_amount, 0) <= _lim.max_amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_scope_allowed(uuid, text, text) FROM anon;

-- ============ Requisition approvals: scope + audit ============
CREATE OR REPLACE FUNCTION public.tg_enforce_pr_approval_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _project text := to_jsonb(NEW) ->> 'project_id';
  _donor text := to_jsonb(NEW) ->> 'donor_id';
  _dept text := to_jsonb(NEW) ->> 'department';
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status IN ('HOD_APPROVED','PENDING_FINANCE_APPROVAL','FINANCE_APPROVED') THEN
    IF NOT public.has_permission(_uid, 'requisitions.approve') THEN
      RAISE EXCEPTION 'You do not have permission to approve requisitions.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_approve_amount(_uid, 'REQUISITION', NEW.total_amount) THEN
      RAISE EXCEPTION 'This exceeds your approval authority or monthly approval limit. Please escalate to a supervisor.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.user_scope_allowed(_uid, 'PROJECT', _project) THEN
      RAISE EXCEPTION 'You are not allowed to approve requisitions for this project.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.user_scope_allowed(_uid, 'DONOR', _donor) THEN
      RAISE EXCEPTION 'You are not allowed to approve requisitions for this donor fund.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.user_scope_allowed(_uid, 'DEPARTMENT', _dept) THEN
      RAISE EXCEPTION 'You are not allowed to approve requisitions for this department.'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.approval_events (organization_id, approver_id, approval_type, entity_id, entity_status, amount)
    VALUES (NEW.organization_id, _uid, 'REQUISITION', NEW.id, NEW.status, NEW.total_amount);
  ELSIF NEW.status IN ('HOD_DECLINED','FINANCE_DECLINED') THEN
    IF NOT public.has_permission(_uid, 'requisitions.decline') THEN
      RAISE EXCEPTION 'You do not have permission to decline requisitions.'
        USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.approval_events (organization_id, approver_id, approval_type, entity_id, entity_status, amount)
    VALUES (NEW.organization_id, _uid, 'REQUISITION_DECLINE', NEW.id, NEW.status, NEW.total_amount);
  END IF;

  RETURN NEW;
END;
$$;

-- ============ Reimbursement approvals: audit ============
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
      RAISE EXCEPTION 'This exceeds your approval authority or monthly approval limit. Please escalate to a supervisor.'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.approval_events (organization_id, approver_id, approval_type, entity_id, entity_status, amount)
    VALUES (NEW.organization_id, _uid, 'REIMBURSEMENT', NEW.id, NEW.status, NEW.amount);
  END IF;

  RETURN NEW;
END;
$$;