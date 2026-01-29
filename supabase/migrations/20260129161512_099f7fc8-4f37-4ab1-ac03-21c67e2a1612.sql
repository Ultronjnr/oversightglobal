-- Create enum for organization-supplier relationship status
CREATE TYPE public.org_supplier_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- Create junction table for organization-supplier relationships
CREATE TABLE public.organization_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status org_supplier_status NOT NULL DEFAULT 'PENDING',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    -- Prevent duplicate relationships
    UNIQUE(supplier_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.organization_suppliers ENABLE ROW LEVEL SECURITY;

-- Suppliers can view their own relationships
CREATE POLICY "Suppliers can view their relationships"
ON public.organization_suppliers
FOR SELECT
USING (
    supplier_id IN (
        SELECT id FROM public.suppliers WHERE user_id = auth.uid()
    )
);

-- Admins can view relationships for their organization
CREATE POLICY "Admins can view org supplier relationships"
ON public.organization_suppliers
FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Finance can view accepted relationships for their organization
CREATE POLICY "Finance can view accepted org suppliers"
ON public.organization_suppliers
FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'FINANCE'::app_role)
    AND status = 'ACCEPTED'
);

-- Suppliers can request to join organizations (insert with PENDING status)
CREATE POLICY "Suppliers can request org membership"
ON public.organization_suppliers
FOR INSERT
WITH CHECK (
    supplier_id IN (
        SELECT id FROM public.suppliers WHERE user_id = auth.uid()
    )
    AND status = 'PENDING'
);

-- Admins can update relationship status for their organization
CREATE POLICY "Admins can update org supplier status"
ON public.organization_suppliers
FOR UPDATE
USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Admins can remove suppliers from their organization
CREATE POLICY "Admins can delete org supplier relationships"
ON public.organization_suppliers
FOR DELETE
USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Add trigger for updated_at
CREATE TRIGGER update_organization_suppliers_updated_at
BEFORE UPDATE ON public.organization_suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();