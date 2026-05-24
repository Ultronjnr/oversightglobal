
-- Allow manual (account-less) suppliers
ALTER TABLE public.suppliers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN contact_email DROP NOT NULL;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_by uuid;

-- Allow Finance/Admin to create manual suppliers in their org
CREATE POLICY "Finance can create manual suppliers"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_role(auth.uid(), 'FINANCE'::app_role)
  AND is_manual = true
  AND user_id IS NULL
);

CREATE POLICY "Admin can create manual suppliers"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  AND is_manual = true
  AND user_id IS NULL
);

CREATE POLICY "Finance can update manual suppliers"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_role(auth.uid(), 'FINANCE'::app_role)
  AND is_manual = true
);
