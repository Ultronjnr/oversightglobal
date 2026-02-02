-- Create category type enum
CREATE TYPE public.category_type AS ENUM ('EXPENSE', 'ASSET');

-- Create categories table (organization-scoped)
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type category_type NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE (organization_id, name)
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Finance and Admin can view categories in their org
CREATE POLICY "Finance can view categories"
ON public.categories
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND has_role(auth.uid(), 'FINANCE'::app_role)
);

CREATE POLICY "Admin can view categories"
ON public.categories
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Finance can create categories
CREATE POLICY "Finance can create categories"
ON public.categories
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'FINANCE'::app_role)
  AND created_by = auth.uid()
);

-- Admin can create categories
CREATE POLICY "Admin can create categories"
ON public.categories
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN'::app_role)
  AND created_by = auth.uid()
);

-- Add category_id to purchase_requisitions (immutable after approval)
ALTER TABLE public.purchase_requisitions
ADD COLUMN category_id UUID REFERENCES public.categories(id);

-- Create index for faster category lookups
CREATE INDEX idx_categories_org_type ON public.categories(organization_id, type);
CREATE INDEX idx_pr_category ON public.purchase_requisitions(category_id);