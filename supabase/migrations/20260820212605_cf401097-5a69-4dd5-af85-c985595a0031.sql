CREATE OR REPLACE FUNCTION public.validate_invitation(_token text, _email text)
 RETURNS TABLE(id uuid, email text, role app_role, department text, organization_id uuid, status text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _hash text := encode(extensions.digest(_token, 'sha256'), 'hex');
BEGIN
  RETURN QUERY
  SELECT i.id, i.email, i.role, i.department, i.organization_id, i.status, i.expires_at
  FROM public.invitations i
  WHERE (i.token_hash = _hash OR i.token_hash = _token)
    AND LOWER(i.email) = LOWER(_email)
  LIMIT 1;
END; $function$;