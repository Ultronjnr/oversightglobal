CREATE OR REPLACE FUNCTION public.plan_limit_for_org(_org uuid, _key text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p.code
    WHEN 'PLATFORM' THEN CASE _key
      WHEN 'users' THEN 5 WHEN 'scans_month' THEN 150 WHEN 'donors' THEN 30
      WHEN 'supplier_invites' THEN 50 WHEN 'receipts_year' THEN 50 END
  END
  FROM organization_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.organization_id = _org AND s.status = 'ACTIVE'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_plan_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key text := TG_ARGV[0]; _lim int; _cnt int; _label text;
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id THEN RETURN NEW; END IF;
  _lim := plan_limit_for_org(NEW.organization_id, _key);
  IF _lim IS NULL THEN RETURN NEW; END IF;
  IF _key = 'users' THEN
    SELECT count(*) INTO _cnt FROM profiles WHERE organization_id = NEW.organization_id; _label := 'users';
  ELSIF _key = 'scans_month' THEN
    SELECT count(*) INTO _cnt FROM ocr_analyses WHERE organization_id = NEW.organization_id AND created_at >= date_trunc('month', now()); _label := 'invoice scans this month';
  ELSIF _key = 'donors' THEN
    SELECT count(*) INTO _cnt FROM organization_donors WHERE organization_id = NEW.organization_id; _label := 'donor profiles';
  ELSIF _key = 'supplier_invites' THEN
    SELECT count(*) INTO _cnt FROM supplier_invitations WHERE organization_id = NEW.organization_id; _label := 'supplier invitations';
  ELSIF _key = 'receipts_year' THEN
    SELECT count(*) INTO _cnt FROM donation_receipts WHERE organization_id = NEW.organization_id AND created_at >= date_trunc('year', now()); _label := 'Section 18A receipts this year';
  END IF;
  IF _cnt >= _lim THEN
    RAISE EXCEPTION 'Plan limit reached: your plan allows % %. Upgrade your plan to add more.', _lim, _label;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enforce_limit_users BEFORE INSERT OR UPDATE OF organization_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limits('users');
CREATE TRIGGER enforce_limit_scans BEFORE INSERT ON public.ocr_analyses FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limits('scans_month');
CREATE TRIGGER enforce_limit_donors BEFORE INSERT ON public.organization_donors FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limits('donors');
CREATE TRIGGER enforce_limit_supplier_invites BEFORE INSERT ON public.supplier_invitations FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limits('supplier_invites');
CREATE TRIGGER enforce_limit_receipts BEFORE INSERT ON public.donation_receipts FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_plan_limits('receipts_year');