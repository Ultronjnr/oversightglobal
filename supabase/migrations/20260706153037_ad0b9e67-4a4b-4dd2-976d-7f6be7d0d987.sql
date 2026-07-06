
-- =========================================================================
-- 1. profiles_org_selfjoin — require invitation to join an organization
-- =========================================================================
CREATE OR REPLACE FUNCTION public.user_can_join_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _org_id IS NULL THEN true
    ELSE EXISTS (
        SELECT 1 FROM public.invitations i
        WHERE lower(i.email) = lower(auth.jwt() ->> 'email')
          AND i.organization_id = _org_id
          AND i.status IN ('pending','accepted')
          AND i.expires_at > now()
      ) OR EXISTS (
        SELECT 1 FROM public.supplier_invitations si
        WHERE lower(si.email) = lower(auth.jwt() ->> 'email')
          AND si.organization_id = _org_id
          AND si.status IN ('PENDING','ACCEPTED','pending','accepted')
          AND si.expires_at > now()
      )
  END
$$;

GRANT EXECUTE ON FUNCTION public.user_can_join_org(uuid) TO authenticated;

-- SECURITY INVOKER (default): current_user reflects the real caller.
CREATE OR REPLACE FUNCTION public.enforce_profile_org_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Trusted contexts (SECURITY DEFINER RPCs owned by postgres, service_role
  -- edge functions) may assign organization freely.
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
    RETURN NEW;
  END IF;

  IF public.user_can_join_org(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You cannot join this organization without a valid invitation'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_org ON public.profiles;
CREATE TRIGGER trg_enforce_profile_org
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_org_assignment();

-- =========================================================================
-- 2. quotes_unlinked_insert — quote must match an issued quote_request
-- =========================================================================
DROP POLICY IF EXISTS "Suppliers can create quotes for their requests" ON public.quotes;
CREATE POLICY "Suppliers can create quotes for their requests"
ON public.quotes
FOR INSERT
WITH CHECK (
  supplier_id IN (SELECT s.id FROM public.suppliers s WHERE s.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.quote_requests qr
    WHERE qr.id = quotes.quote_request_id
      AND qr.supplier_id = quotes.supplier_id
      AND qr.pr_id = quotes.pr_id
      AND qr.organization_id = quotes.organization_id
  )
);

-- =========================================================================
-- 3. suppliers_crosstenant — self-insert requires a matching invitation
-- =========================================================================
DROP POLICY IF EXISTS "Suppliers can insert own record" ON public.suppliers;
CREATE POLICY "Suppliers can insert own record"
ON public.suppliers
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE lower(si.email) = lower(auth.jwt() ->> 'email')
      AND si.organization_id = suppliers.organization_id
      AND si.status IN ('PENDING','ACCEPTED','pending','accepted')
      AND si.expires_at > now()
  )
);

-- =========================================================================
-- 4. pr_system_note_forge — block client-set system notes; add trusted RPC
-- =========================================================================
DROP POLICY IF EXISTS "Admin can send messages to PRs in their org" ON public.pr_messages;
CREATE POLICY "Admin can send messages to PRs in their org"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_system_note = false
  AND has_role(auth.uid(), 'ADMIN'::app_role)
  AND EXISTS (
    SELECT 1 FROM purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
      AND pr.organization_id = get_user_organization(auth.uid())
  )
);

DROP POLICY IF EXISTS "Employees can send messages to their PRs" ON public.pr_messages;
CREATE POLICY "Employees can send messages to their PRs"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_system_note = false
  AND EXISTS (
    SELECT 1 FROM purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
      AND pr.requested_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Finance can send messages to PRs in their org" ON public.pr_messages;
CREATE POLICY "Finance can send messages to PRs in their org"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_system_note = false
  AND has_role(auth.uid(), 'FINANCE'::app_role)
  AND EXISTS (
    SELECT 1 FROM purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
      AND pr.organization_id = get_user_organization(auth.uid())
  )
);

DROP POLICY IF EXISTS "HOD can send messages to PRs in their org" ON public.pr_messages;
CREATE POLICY "HOD can send messages to PRs in their org"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_system_note = false
  AND has_role(auth.uid(), 'HOD'::app_role)
  AND EXISTS (
    SELECT 1 FROM purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
      AND pr.organization_id = get_user_organization(auth.uid())
  )
);

DROP POLICY IF EXISTS "Suppliers can send messages to their PRs" ON public.pr_messages;
CREATE POLICY "Suppliers can send messages to their PRs"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_system_note = false
  AND has_role(auth.uid(), 'SUPPLIER'::app_role)
  AND EXISTS (
    SELECT 1 FROM quote_requests qr
    JOIN suppliers s ON s.id = qr.supplier_id
    WHERE qr.pr_id = pr_messages.pr_id
      AND s.user_id = auth.uid()
      AND s.organization_id = pr_messages.organization_id
  )
);

-- Trusted routine to record a genuine system audit note.
CREATE OR REPLACE FUNCTION public.post_pr_system_note(_pr_id uuid, _note text)
RETURNS public.pr_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pr record;
  _role text;
  _name text;
  _allowed boolean := false;
  _row public.pr_messages;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT id, organization_id, requested_by
    INTO _pr
  FROM public.purchase_requisitions
  WHERE id = _pr_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase requisition not found';
  END IF;

  IF _pr.organization_id = get_user_organization(_uid) THEN
    _allowed := true;
  ELSIF _pr.requested_by = _uid THEN
    _allowed := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.quote_requests qr
    JOIN public.suppliers s ON s.id = qr.supplier_id
    WHERE qr.pr_id = _pr_id AND s.user_id = _uid
  ) THEN
    _allowed := true;
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Not authorized for this purchase requisition' USING ERRCODE = '42501';
  END IF;

  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  SELECT COALESCE(NULLIF(trim(coalesce(name,'') || ' ' || coalesce(surname,'')), ''), email)
    INTO _name
  FROM public.profiles WHERE id = _uid;

  INSERT INTO public.pr_messages
    (pr_id, sender_id, sender_name, sender_role, message, organization_id, is_system_note)
  VALUES
    (_pr_id, _uid, COALESCE(_name, 'System'), _role, trim(_note), _pr.organization_id, true)
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_pr_system_note(uuid, text) TO authenticated;

-- =========================================================================
-- 5. supplier_invitations_update_redundant_check — lock immutable fields
-- =========================================================================
DROP POLICY IF EXISTS "Admins can update supplier invitations" ON public.supplier_invitations;
CREATE POLICY "Admins can update supplier invitations"
ON public.supplier_invitations
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- SECURITY INVOKER: preserves immutable fields for direct end-user updates
-- while trusted definer/service flows (e.g. resend_supplier_invite) can rotate them.
CREATE OR REPLACE FUNCTION public.enforce_supplier_invitation_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    NEW.token := OLD.token;
    NEW.email := OLD.email;
    NEW.invited_by := OLD.invited_by;
    NEW.organization_id := OLD.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_invitation_immutable ON public.supplier_invitations;
CREATE TRIGGER trg_supplier_invitation_immutable
BEFORE UPDATE ON public.supplier_invitations
FOR EACH ROW EXECUTE FUNCTION public.enforce_supplier_invitation_immutable();

-- =========================================================================
-- 6. quote_invoice_pr_documents_like_match — exact path matching
-- =========================================================================
DROP POLICY IF EXISTS "Admin can view org quote documents" ON storage.objects;
CREATE POLICY "Admin can view org quote documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND has_role(auth.uid(), 'ADMIN'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE q.document_url = objects.name
      AND q.organization_id = p.organization_id
  )
);

DROP POLICY IF EXISTS "Finance can view org quote documents" ON storage.objects;
CREATE POLICY "Finance can view org quote documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-documents'
  AND has_role(auth.uid(), 'FINANCE'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE q.document_url = objects.name
      AND q.organization_id = p.organization_id
  )
);

DROP POLICY IF EXISTS "PR participants can view PR documents" ON storage.objects;
CREATE POLICY "PR participants can view PR documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'pr-documents'
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.purchase_requisitions pr
      WHERE (
          pr.document_url = objects.name
          OR split_part(split_part(pr.document_url, '/pr-documents/', 2), '?', 1) = objects.name
        )
        AND pr.organization_id = get_user_organization(auth.uid())
        AND (
          pr.requested_by = auth.uid()
          OR has_role(auth.uid(), 'FINANCE'::app_role)
          OR has_role(auth.uid(), 'HOD'::app_role)
          OR has_role(auth.uid(), 'ADMIN'::app_role)
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.suppliers s
      JOIN public.quote_requests qr ON qr.supplier_id = s.id
      JOIN public.purchase_requisitions pr ON pr.id = qr.pr_id
      WHERE s.user_id = auth.uid()
        AND (
          pr.document_url = objects.name
          OR split_part(split_part(pr.document_url, '/pr-documents/', 2), '?', 1) = objects.name
        )
    )
  )
);
