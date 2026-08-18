-- 1. Restore execute permissions on the public invitation RPCs (invitees are not
--    signed in yet, so anon must be able to call them).
GRANT EXECUTE ON FUNCTION public.validate_invitation(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_invitation_signup(text, text, uuid, text, text) TO anon, authenticated;

-- 2. Pricing: two public plans only.
UPDATE public.subscription_plans
   SET name = 'Platform Pro',
       price_monthly = 1900,
       price_annual = 19000,
       is_recommended = true,
       is_public = true,
       is_active = true
 WHERE code = 'PLATFORM';

UPDATE public.subscription_plans
   SET is_active = false, is_public = false, is_recommended = false
 WHERE code IN ('FUNDER_READY', 'BUSINESS');

UPDATE public.subscription_plans
   SET is_public = true, is_active = true, is_custom = true, tier = 2
 WHERE code = 'TAILORED';

-- 3. 14-day free trial tracking
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

UPDATE public.organization_subscriptions
   SET trial_ends_at = COALESCE(trial_ends_at, created_at + interval '14 days')
 WHERE status IN ('TRIALING', 'INCOMPLETE');

-- Every organization gets a 14-day trial the moment it is created.
CREATE OR REPLACE FUNCTION public.tg_start_org_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_subscriptions
    (organization_id, status, billing_cycle, trial_ends_at, current_period_start, current_period_end)
  VALUES
    (NEW.id, 'TRIALING', 'MONTHLY', now() + interval '14 days', CURRENT_DATE, (CURRENT_DATE + 14))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_start_org_trial ON public.organizations;
CREATE TRIGGER trg_start_org_trial
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_start_org_trial();

-- Backfill trials for existing organizations without a subscription row
INSERT INTO public.organization_subscriptions
  (organization_id, status, billing_cycle, trial_ends_at, current_period_start, current_period_end)
SELECT o.id, 'TRIALING', 'MONTHLY', o.created_at + interval '14 days', o.created_at::date, (o.created_at + interval '14 days')::date
  FROM public.organizations o
 WHERE NOT EXISTS (
   SELECT 1 FROM public.organization_subscriptions s WHERE s.organization_id = o.id
 );

-- 4. Single source of truth for subscription access state
CREATE OR REPLACE FUNCTION public.get_subscription_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_sub public.organization_subscriptions%ROWTYPE;
  v_days int;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('locked', false, 'status', null, 'trial_days_left', null);
  END IF;

  SELECT * INTO v_sub FROM public.organization_subscriptions WHERE organization_id = v_org LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('locked', false, 'status', null, 'trial_days_left', null);
  END IF;

  v_days := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (COALESCE(v_sub.trial_ends_at, now()) - now())) / 86400)::int);

  RETURN jsonb_build_object(
    'status', v_sub.status,
    'plan_id', v_sub.plan_id,
    'trial_ends_at', v_sub.trial_ends_at,
    'trial_days_left', CASE WHEN v_sub.status = 'TRIALING' THEN v_days ELSE null END,
    'locked', (v_sub.status = 'TRIALING' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at < now())
              OR v_sub.status IN ('PAST_DUE', 'CANCELLED')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_state() TO authenticated;