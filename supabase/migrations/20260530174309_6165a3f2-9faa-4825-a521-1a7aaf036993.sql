-- Fix 1: Enforce strict expiry for supplier role self-assignment
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
    -- that has NOT expired (strict expiry boundary)
    RETURN EXISTS (
      SELECT 1 FROM public.supplier_invitations
      WHERE LOWER(email) = LOWER(_email)
        AND status IN ('PENDING','ACCEPTED','pending','accepted')
        AND expires_at > now()
    ) OR EXISTS (
      SELECT 1 FROM public.invitations
      WHERE LOWER(email) = LOWER(_email)
        AND role = 'SUPPLIER'
        AND status IN ('pending','accepted')
        AND expires_at > now()
    );
  END IF;

  RETURN FALSE;
END;
$function$;

-- Fix 2: Add IS NOT NULL guard so NULL-org users can't read each other's PR documents
DROP POLICY IF EXISTS "Org members can view PR documents" ON storage.objects;
CREATE POLICY "Org members can view PR documents"
ON storage.objects
FOR SELECT
USING (
  (bucket_id = 'pr-documents'::text)
  AND (auth.uid() IS NOT NULL)
  AND (
    (EXISTS (
      SELECT 1
      FROM profiles viewer
      JOIN profiles uploader ON (viewer.organization_id = uploader.organization_id)
      WHERE viewer.id = auth.uid()
        AND viewer.organization_id IS NOT NULL
        AND uploader.organization_id IS NOT NULL
        AND uploader.id = ((storage.foldername(objects.name))[1])::uuid
    ))
    OR
    (EXISTS (
      SELECT 1
      FROM suppliers s
      JOIN quote_requests qr ON (qr.supplier_id = s.id)
      JOIN purchase_requisitions pr ON (pr.id = qr.pr_id)
      WHERE s.user_id = auth.uid()
        AND pr.document_url LIKE ('%' || objects.name || '%')
    ))
  )
);