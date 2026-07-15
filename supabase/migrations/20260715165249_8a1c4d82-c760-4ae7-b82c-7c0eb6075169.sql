-- 1. next_donation_receipt_number: verify caller belongs to org and is donation manager
CREATE OR REPLACE FUNCTION public.next_donation_receipt_number(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _prefix text; _num integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF public.get_user_organization(auth.uid()) IS DISTINCT FROM _org_id THEN
    RAISE EXCEPTION 'Not authorized for organization';
  END IF;
  IF NOT public.is_donation_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to issue receipts';
  END IF;

  INSERT INTO public.donation_org_profiles (organization_id)
  VALUES (_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.donation_org_profiles
  SET next_receipt_number = next_receipt_number + 1
  WHERE organization_id = _org_id
  RETURNING receipt_prefix, next_receipt_number - 1 INTO _prefix, _num;

  RETURN _prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(_num::text, 4, '0');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.next_donation_receipt_number(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_donation_receipt_number(uuid) TO authenticated;

-- 2. accept_supplier_invitation_token: trust auth.uid(), reject anonymous
CREATE OR REPLACE FUNCTION public.accept_supplier_invitation_token(_token uuid, _user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _inv record;
  _uid uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO _inv FROM public.supplier_invitations
  WHERE token = _token AND status = 'PENDING' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.supplier_invitations
  SET status = 'ACCEPTED', accepted_at = now(), supplier_user_id = _uid
  WHERE id = _inv.id;

  INSERT INTO public.supplier_invitation_audit_log (invitation_id, organization_id, action, performed_by)
  VALUES (_inv.id, _inv.organization_id, 'ACCEPTED', _uid);

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.accept_supplier_invitation_token(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation_token(uuid, uuid) TO authenticated;

-- 3. profiles: prevent self-assignment of organization_id at column level
REVOKE UPDATE (organization_id) ON public.profiles FROM authenticated;
REVOKE INSERT (organization_id) ON public.profiles FROM authenticated;

-- 4. pr_messages: is_system_note not client-writable
REVOKE INSERT (is_system_note) ON public.pr_messages FROM authenticated;
REVOKE UPDATE (is_system_note) ON public.pr_messages FROM authenticated;

-- 5. suppliers: tighten self-registration policy
DROP POLICY IF EXISTS "Suppliers can insert own record" ON public.suppliers;
CREATE POLICY "Suppliers can insert own record"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_manual = false
  AND is_verified = false
  AND EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE lower(si.email) = lower(auth.jwt() ->> 'email')
      AND si.organization_id = suppliers.organization_id
      AND si.status IN ('PENDING','pending')
      AND si.expires_at > now()
  )
);

-- 6. quotes: only allow inserts against a still-pending quote request
DROP POLICY IF EXISTS "Suppliers can create quotes for their requests" ON public.quotes;
CREATE POLICY "Suppliers can create quotes for their requests"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (SELECT s.id FROM public.suppliers s WHERE s.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.quote_requests qr
    WHERE qr.id = quotes.quote_request_id
      AND qr.supplier_id = quotes.supplier_id
      AND qr.pr_id = quotes.pr_id
      AND qr.organization_id = quotes.organization_id
      AND qr.status = 'PENDING'
  )
);