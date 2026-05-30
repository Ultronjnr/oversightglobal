CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  budget_limit NUMERIC,
  manager_user_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_departments_organization_id ON public.departments(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view departments"
ON public.departments
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can create departments"
ON public.departments
FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins can update departments"
ON public.departments
FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role))
WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins can delete departments"
ON public.departments
FOR DELETE
TO authenticated
USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();