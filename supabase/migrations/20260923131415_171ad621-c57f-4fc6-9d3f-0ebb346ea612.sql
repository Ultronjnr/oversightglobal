CREATE OR REPLACE FUNCTION public.platform_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'categories', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT COALESCE(c.name, 'Uncategorised') AS label, count(*) AS value, COALESCE(sum(t.amount),0) AS amount FROM public.transactions t LEFT JOIN public.purchase_requisitions pr ON pr.id = t.pr_id LEFT JOIN public.categories c ON c.id = pr.category_id GROUP BY 1 ORDER BY 3 DESC LIMIT 12) x),
    'monthly', (SELECT COALESCE(jsonb_agg(x ORDER BY x.month), '[]'::jsonb) FROM (SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*) AS value, COALESCE(sum(amount),0) AS amount FROM public.transactions WHERE created_at > now() - interval '12 months' GROUP BY 1) x),
    'organization_growth', (SELECT COALESCE(jsonb_agg(x ORDER BY x.month), '[]'::jsonb) FROM (SELECT to_char(month_start, 'YYYY-MM') AS month, (SELECT count(*) FROM public.organizations o WHERE o.created_at < month_start + interval '1 month') AS total, (SELECT count(*) FROM public.organizations o WHERE date_trunc('month', o.created_at) = month_start) AS new_organizations FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') month_start) x)
  ) INTO result;
  RETURN result;
END;
$function$;