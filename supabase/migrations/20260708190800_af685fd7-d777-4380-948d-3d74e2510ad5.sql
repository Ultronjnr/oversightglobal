
-- Security-definer helpers to read existing (pre-update) protected values, bypassing RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.supplier_current_org(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.suppliers WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION public.supplier_current_verified(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_verified FROM public.suppliers WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION public.quote_request_current_org(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.quote_requests WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION public.quote_request_current_supplier(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT supplier_id FROM public.quote_requests WHERE id = _id
$$;

-- Suppliers can update own record: pin organization_id and is_verified to existing values
DROP POLICY IF EXISTS "Suppliers can update own record" ON public.suppliers;
CREATE POLICY "Suppliers can update own record"
ON public.suppliers
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.supplier_current_org(id)
  AND is_verified = public.supplier_current_verified(id)
);

-- Suppliers can update their quote requests: pin organization_id and supplier_id to existing values
DROP POLICY IF EXISTS "Suppliers can update their quote requests" ON public.quote_requests;
CREATE POLICY "Suppliers can update their quote requests"
ON public.quote_requests
FOR UPDATE
USING (
  supplier_id IN (SELECT suppliers.id FROM public.suppliers WHERE suppliers.user_id = auth.uid())
)
WITH CHECK (
  supplier_id IN (SELECT suppliers.id FROM public.suppliers WHERE suppliers.user_id = auth.uid())
  AND organization_id = public.quote_request_current_org(id)
  AND supplier_id = public.quote_request_current_supplier(id)
);
