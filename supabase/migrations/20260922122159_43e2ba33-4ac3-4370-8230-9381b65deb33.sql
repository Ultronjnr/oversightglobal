
-- 1. Platform staff -----------------------------------------------------
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id);
$$;

CREATE POLICY "Platform staff can see the staff list"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 2. Advertisements -----------------------------------------------------
CREATE TABLE public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  headline text NOT NULL,
  body text,
  image_url text,
  cta_label text,
  cta_url text,
  tone text NOT NULL DEFAULT 'primary',
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT',
  starts_at timestamptz,
  ends_at timestamptz,
  target_all boolean NOT NULL DEFAULT true,
  target_org_types text[] NOT NULL DEFAULT '{}',
  target_tiers text[] NOT NULL DEFAULT '{}',
  target_roles text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertisements_status_check CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  CONSTRAINT advertisements_tone_check CHECK (tone IN ('primary','success','warning','destructive'))
);

GRANT SELECT ON public.advertisements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.advertisement_targets (
  advertisement_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (advertisement_id, organization_id)
);

GRANT SELECT, INSERT, DELETE ON public.advertisement_targets TO authenticated;
GRANT ALL ON public.advertisement_targets TO service_role;
ALTER TABLE public.advertisement_targets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.advertisement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertisement_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertisement_events_type_check CHECK (event_type IN ('VIEW','CLICK'))
);

GRANT SELECT, INSERT ON public.advertisement_events TO authenticated;
GRANT ALL ON public.advertisement_events TO service_role;
ALTER TABLE public.advertisement_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ads_status_window ON public.advertisements (status, starts_at, ends_at);
CREATE INDEX idx_ad_events_ad ON public.advertisement_events (advertisement_id, event_type);

-- helper: is this advert currently live for the signed-in user's organisation?
CREATE OR REPLACE FUNCTION public.advertisement_visible_to_me(_ad public.advertisements)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _ad.status = 'PUBLISHED'
     AND (_ad.starts_at IS NULL OR _ad.starts_at <= now())
     AND (_ad.ends_at IS NULL OR _ad.ends_at >= now())
     AND (
       _ad.target_all
       OR EXISTS (
         SELECT 1 FROM public.advertisement_targets t
         WHERE t.advertisement_id = _ad.id
           AND t.organization_id = public.get_user_organization(auth.uid())
       )
       OR (
         cardinality(_ad.target_org_types) > 0
         AND EXISTS (
           SELECT 1 FROM public.organizations o
           WHERE o.id = public.get_user_organization(auth.uid())
             AND o.organisation_type::text = ANY (_ad.target_org_types)
         )
       )
     )
     AND (
       cardinality(_ad.target_roles) = 0
       OR public.get_user_role(auth.uid())::text = ANY (_ad.target_roles)
     );
$$;

CREATE POLICY "Staff manage adverts"
  ON public.advertisements FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users read adverts targeted at them"
  ON public.advertisements FOR SELECT TO authenticated
  USING (public.advertisement_visible_to_me(advertisements));

CREATE POLICY "Staff manage advert targets"
  ON public.advertisement_targets FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Staff read advert events"
  ON public.advertisement_events FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users record their own advert events"
  ON public.advertisement_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Platform-wide reporting (staff only) --------------------------------
CREATE OR REPLACE FUNCTION public.platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT jsonb_build_object(
    'organizations', (SELECT count(*) FROM public.organizations),
    'users', (SELECT count(*) FROM public.profiles),
    'active_users_30d', (
      SELECT count(DISTINCT u.id) FROM auth.users u
      WHERE u.last_sign_in_at > now() - interval '30 days'
    ),
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
    'org_types', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT COALESCE(organisation_type::text, 'Unspecified') AS label, count(*) AS value
        FROM public.organizations GROUP BY 1 ORDER BY 2 DESC
      ) x
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT COALESCE(c.name, 'Uncategorised') AS label,
               count(*) AS value,
               COALESCE(sum(t.amount),0) AS amount
        FROM public.transactions t
        LEFT JOIN public.categories c ON c.id = t.category_id
        GROUP BY 1 ORDER BY 3 DESC LIMIT 12
      ) x
    ),
    'monthly', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.month), '[]'::jsonb) FROM (
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               count(*) AS value,
               COALESCE(sum(amount),0) AS amount
        FROM public.transactions
        WHERE created_at > now() - interval '12 months'
        GROUP BY 1
      ) x
    )
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  organisation_type text,
  created_at timestamptz,
  users bigint,
  transactions bigint,
  transaction_value numeric,
  requisitions bigint,
  donations_value numeric,
  last_activity timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.name,
         COALESCE(o.organisation_type::text, 'Unspecified'),
         o.created_at,
         (SELECT count(*) FROM public.profiles p WHERE p.organization_id = o.id),
         (SELECT count(*) FROM public.transactions t WHERE t.organization_id = o.id),
         (SELECT COALESCE(sum(t.amount),0) FROM public.transactions t WHERE t.organization_id = o.id),
         (SELECT count(*) FROM public.purchase_requisitions r WHERE r.organization_id = o.id),
         (SELECT COALESCE(sum(d.amount),0) FROM public.donations d WHERE d.organization_id = o.id),
         (SELECT max(t.created_at) FROM public.transactions t WHERE t.organization_id = o.id)
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_ad_performance()
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  views bigint,
  clicks bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT a.id, a.title, a.status, a.starts_at, a.ends_at,
         (SELECT count(*) FROM public.advertisement_events e WHERE e.advertisement_id = a.id AND e.event_type = 'VIEW'),
         (SELECT count(*) FROM public.advertisement_events e WHERE e.advertisement_id = a.id AND e.event_type = 'CLICK')
  FROM public.advertisements a
  ORDER BY a.created_at DESC;
END;
$$;
