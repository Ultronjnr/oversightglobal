
-- 1. Attachments storage: tighten INSERT, add UPDATE
DROP POLICY IF EXISTS "Org members can upload attachments storage" ON storage.objects;

CREATE POLICY "Org members can upload attachments storage"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND auth.uid() IS NOT NULL
  AND get_user_organization(auth.uid()) IS NOT NULL
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
);

DROP POLICY IF EXISTS "Finance/Admin can update attachments storage" ON storage.objects;

CREATE POLICY "Finance/Admin can update attachments storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
)
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

-- Also tighten SELECT and DELETE to authenticated role only (was {public})
DROP POLICY IF EXISTS "Org members can read attachments storage" ON storage.objects;
CREATE POLICY "Org members can read attachments storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
);

DROP POLICY IF EXISTS "Finance/Admin can delete attachments storage" ON storage.objects;
CREATE POLICY "Finance/Admin can delete attachments storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (get_user_organization(auth.uid()))::text
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

-- 2. Update is_valid_self_role_assignment to also check supplier_invitations
CREATE OR REPLACE FUNCTION public.is_valid_self_role_assignment(_role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
BEGIN
  IF _role = 'EMPLOYEE' THEN
    RETURN TRUE;
  END IF;

  IF _role = 'SUPPLIER' THEN
    SELECT email INTO _email FROM public.profiles WHERE id = auth.uid();
    IF _email IS NULL THEN
      RETURN FALSE;
    END IF;
    -- Accept either a generic invitation OR a dedicated supplier invitation
    RETURN EXISTS (
      SELECT 1 FROM public.supplier_invitations
      WHERE LOWER(email) = LOWER(_email)
        AND status IN ('PENDING','ACCEPTED','pending','accepted')
        AND expires_at > now() - interval '30 days'
    ) OR EXISTS (
      SELECT 1 FROM public.invitations
      WHERE LOWER(email) = LOWER(_email)
        AND role = 'SUPPLIER'
        AND status IN ('pending','accepted')
        AND expires_at > now() - interval '30 days'
    );
  END IF;

  RETURN FALSE;
END;
$function$;
