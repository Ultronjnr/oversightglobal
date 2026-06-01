-- Allow any organization member to view approved (verified) suppliers in their org
CREATE POLICY "Org members can view verified suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND is_verified = true
);

-- Table to capture employee-suggested new suppliers for Finance approval
CREATE TABLE public.supplier_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  suggested_by uuid NOT NULL,
  suggested_by_name text,
  company_name text NOT NULL,
  contact_email text,
  phone text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_suggestions TO authenticated;
GRANT ALL ON public.supplier_suggestions TO service_role;

ALTER TABLE public.supplier_suggestions ENABLE ROW LEVEL SECURITY;

-- Employees can create suggestions for their own organization
CREATE POLICY "Members can create supplier suggestions"
ON public.supplier_suggestions
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND suggested_by = auth.uid()
);

-- Employees can view their own suggestions
CREATE POLICY "Members can view own supplier suggestions"
ON public.supplier_suggestions
FOR SELECT
TO authenticated
USING (suggested_by = auth.uid());

-- Finance/Admin can view all org suggestions
CREATE POLICY "Finance/Admin can view org supplier suggestions"
ON public.supplier_suggestions
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

-- Finance/Admin can review (update) org suggestions
CREATE POLICY "Finance/Admin can update org supplier suggestions"
ON public.supplier_suggestions
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);