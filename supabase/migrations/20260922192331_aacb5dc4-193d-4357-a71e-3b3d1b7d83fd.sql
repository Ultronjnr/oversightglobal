CREATE OR REPLACE FUNCTION public.platform_customer_intelligence()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  organisation_type text,
  company_email text,
  phone text,
  address text,
  registration_number text,
  tax_number text,
  pbo_registered boolean,
  pbo_number text,
  organization_created_at timestamptz,
  contact_name text,
  contact_email text,
  contact_phone text,
  pain_point text,
  cause text,
  funding text,
  team_size text,
  heard_about text,
  onboarding_completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.organisation_type::text,
    o.company_email,
    o.phone,
    o.address,
    o.registration_number,
    o.tax_number,
    o.pbo_registered,
    o.pbo_number,
    o.created_at,
    trim(concat_ws(' ', admin_profile.name, admin_profile.surname)),
    COALESCE(o.company_email, admin_profile.email),
    COALESCE(o.phone, admin_profile.phone),
    COALESCE(NULLIF(ob.pain_point_other, ''), ob.pain_point),
    COALESCE(NULLIF(ob.cause_other, ''), ob.cause),
    COALESCE(NULLIF(ob.funding_other, ''), ob.funding),
    ob.team_size,
    COALESCE(NULLIF(ob.heard_about_other, ''), ob.heard_about),
    ob.completed_at
  FROM public.organizations o
  LEFT JOIN public.organization_onboarding ob ON ob.organization_id = o.id
  LEFT JOIN LATERAL (
    SELECT p.name, p.surname, p.email, p.phone
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'ADMIN'
    WHERE p.organization_id = o.id
    ORDER BY (ur.user_id IS NOT NULL) DESC, p.created_at ASC
    LIMIT 1
  ) admin_profile ON true
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_customer_intelligence() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_customer_intelligence() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_recent_users(_limit integer DEFAULT 20)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  phone text,
  status text,
  role text,
  organization_id uuid,
  organization_name text,
  organisation_type text,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    trim(concat_ws(' ', p.name, p.surname)),
    p.email,
    p.phone,
    p.status::text,
    roles.role,
    p.organization_id,
    o.name,
    o.organisation_type::text,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  LEFT JOIN LATERAL (
    SELECT string_agg(ur.role::text, ', ' ORDER BY ur.role::text) AS role
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
  ) roles ON true
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_recent_users(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_recent_users(integer) TO authenticated, service_role;