
-- Tighten supplier invoice document SELECT: require join to invoices table
DROP POLICY IF EXISTS "Suppliers can view their invoice documents" ON storage.objects;
CREATE POLICY "Suppliers can view their invoice documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoice-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.suppliers s ON s.id = i.supplier_id
    WHERE i.document_url = objects.name
      AND s.user_id = auth.uid()
  )
);

-- Tighten supplier quote document SELECT: require join to quotes table
DROP POLICY IF EXISTS "Suppliers can view own quote documents" ON storage.objects;
CREATE POLICY "Suppliers can view own quote documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.suppliers s ON s.id = q.supplier_id
    WHERE q.document_url = objects.name
      AND s.user_id = auth.uid()
  )
);

-- Tighten PR document UPDATE/DELETE: require join to purchase_requisitions
DROP POLICY IF EXISTS "Org members can update their own PR documents" ON storage.objects;
CREATE POLICY "Org members can update their own PR documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pr-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE (pr.document_url = objects.name
        OR split_part(split_part(pr.document_url, '/pr-documents/', 2), '?', 1) = objects.name)
      AND pr.requested_by = auth.uid()
      AND pr.organization_id = public.get_user_organization(auth.uid())
  )
);

DROP POLICY IF EXISTS "Org members can delete their own PR documents" ON storage.objects;
CREATE POLICY "Org members can delete their own PR documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pr-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE (pr.document_url = objects.name
        OR split_part(split_part(pr.document_url, '/pr-documents/', 2), '?', 1) = objects.name)
      AND pr.requested_by = auth.uid()
      AND pr.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Add safeguard: prevent removing the last ADMIN in an organization
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
  remaining_admins int;
BEGIN
  IF OLD.role <> 'ADMIN'::app_role THEN
    RETURN OLD;
  END IF;

  SELECT organization_id INTO org_id FROM public.profiles WHERE id = OLD.user_id;

  IF org_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO remaining_admins
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'ADMIN'::app_role
    AND p.organization_id = org_id
    AND ur.id <> OLD.id;

  IF remaining_admins = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last admin from the organization';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_removal ON public.user_roles;
CREATE TRIGGER trg_prevent_last_admin_removal
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();
