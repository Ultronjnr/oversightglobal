
-- Create supplier_invitations table
CREATE TABLE public.supplier_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  email text NOT NULL,
  company_name text NOT NULL,
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.supplier_invitations ENABLE ROW LEVEL SECURITY;

-- Admin can insert invitations for their org
CREATE POLICY "Admins can create supplier invitations"
ON public.supplier_invitations
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN')
  AND invited_by = auth.uid()
);

-- Admin can view supplier invitations for their org
CREATE POLICY "Admins can view supplier invitations"
ON public.supplier_invitations
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN')
);

-- Admin can update supplier invitations for their org
CREATE POLICY "Admins can update supplier invitations"
ON public.supplier_invitations
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN')
);

-- Public can read pending invitations by token (for the join page)
CREATE POLICY "Anyone can validate pending supplier invitation tokens"
ON public.supplier_invitations
FOR SELECT
USING (status = 'PENDING' AND expires_at > now());
