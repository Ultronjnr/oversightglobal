CREATE TABLE public.platform_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 500),
  referrer_host text,
  device_type text NOT NULL CHECK (device_type IN ('Desktop', 'Mobile', 'Tablet')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.platform_analytics_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_analytics_events TO service_role;
ALTER TABLE public.platform_analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitors record analytics events"
  ON public.platform_analytics_events FOR INSERT TO anon, authenticated
  WITH CHECK (occurred_at >= now() - interval '5 minutes' AND occurred_at <= now() + interval '1 minute');
CREATE INDEX idx_platform_analytics_occurred_at ON public.platform_analytics_events (occurred_at DESC);
CREATE INDEX idx_platform_analytics_session ON public.platform_analytics_events (session_id, occurred_at);

CREATE OR REPLACE FUNCTION public.platform_live_analytics(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
DECLARE safe_days integer := LEAST(GREATEST(_days, 1), 365);
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH scoped AS (
    SELECT * FROM public.platform_analytics_events
    WHERE occurred_at >= now() - make_interval(days => safe_days)
  ), session_counts AS (
    SELECT session_id, count(*) AS views FROM scoped GROUP BY session_id
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT count(DISTINCT session_id) FROM scoped),
    'page_views', (SELECT count(*) FROM scoped),
    'views_per_visit', COALESCE((SELECT round(count(*)::numeric / NULLIF(count(DISTINCT session_id), 0), 2) FROM scoped), 0),
    'bounce_rate', COALESCE((SELECT round(100.0 * count(*) FILTER (WHERE views = 1) / NULLIF(count(*), 0), 1) FROM session_counts), 0),
    'daily', (SELECT COALESCE(jsonb_agg(x ORDER BY x.day), '[]'::jsonb) FROM (
      SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day,
             count(DISTINCT session_id) AS visitors,
             count(*) AS page_views
      FROM scoped GROUP BY 1
    ) x),
    'pages', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT path AS label, count(*) AS value FROM scoped GROUP BY path ORDER BY count(*) DESC LIMIT 10
    ) x),
    'sources', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT COALESCE(NULLIF(referrer_host, ''), 'Direct') AS label, count(DISTINCT session_id) AS value
      FROM scoped GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    ) x),
    'devices', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT device_type AS label, count(DISTINCT session_id) AS value FROM scoped GROUP BY 1 ORDER BY 2 DESC
    ) x)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_live_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_live_analytics(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT jsonb_build_object(
    'organizations', (SELECT count(*) FROM public.organizations),
    'users', (SELECT count(*) FROM public.profiles),
    'active_users_30d', (SELECT count(DISTINCT u.id) FROM auth.users u WHERE u.last_sign_in_at > now() - interval '30 days'),
    'transactions', (SELECT count(*) FROM public.transactions),
    'transaction_value', (SELECT COALESCE(sum(amount),0) FROM public.transactions),
    'paid_value', (SELECT COALESCE(sum(amount_paid),0) FROM public.transactions),
    'requisitions', (SELECT count(*) FROM public.purchase_requisitions),
    'quotes', (SELECT count(*) FROM public.quotes),
    'suppliers', (SELECT count(*) FROM public.suppliers),
    'scans', (SELECT count(*) FROM public.ocr_analyses),
    'batches', (SELECT count(*) FROM public.payment_batches),
    'donors', (SELECT count(*) FROM public.organization_donors),
    'projects', (SELECT count(*) FROM public.donation_projects),
    'donations_value', (SELECT COALESCE(sum(amount),0) FROM public.donations),
    'receipts', (SELECT count(*) FROM public.donation_receipts),
    'ad_views', (SELECT count(*) FROM public.advertisement_events WHERE event_type = 'VIEW'),
    'ad_clicks', (SELECT count(*) FROM public.advertisement_events WHERE event_type = 'CLICK'),
    'org_types', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT organisation_type::text AS label, count(*) AS value FROM public.organizations WHERE organisation_type IS NOT NULL GROUP BY 1 ORDER BY 2 DESC) x),
    'industries', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT COALESCE(NULLIF(cause_other,''), cause) AS label, count(*) AS value FROM public.organization_onboarding WHERE COALESCE(NULLIF(cause_other,''), cause) IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x),
    'categories', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT COALESCE(c.name, 'Uncategorised') AS label, count(*) AS value, COALESCE(sum(t.amount),0) AS amount FROM public.transactions t LEFT JOIN public.categories c ON c.id = t.category_id GROUP BY 1 ORDER BY 3 DESC LIMIT 12) x),
    'monthly', (SELECT COALESCE(jsonb_agg(x ORDER BY x.month), '[]'::jsonb) FROM (SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*) AS value, COALESCE(sum(amount),0) AS amount FROM public.transactions WHERE created_at > now() - interval '12 months' GROUP BY 1) x),
    'organization_growth', (SELECT COALESCE(jsonb_agg(x ORDER BY x.month), '[]'::jsonb) FROM (SELECT to_char(month_start, 'YYYY-MM') AS month, (SELECT count(*) FROM public.organizations o WHERE o.created_at < month_start + interval '1 month') AS total, (SELECT count(*) FROM public.organizations o WHERE date_trunc('month', o.created_at) = month_start) AS new_organizations FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') month_start) x)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_overview() TO authenticated, service_role;