CREATE TABLE public.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  funding_source_editors TEXT NOT NULL DEFAULT 'FINANCE_ADMIN' CHECK (funding_source_editors IN ('FINANCE_ADMIN','HOD_UP','ALL_STAFF')),
  require_vat_document BOOLEAN NOT NULL DEFAULT false,
  supplier_sourcing_roles TEXT NOT NULL DEFAULT 'FINANCE_ADMIN' CHECK (supplier_sourcing_roles IN ('FINANCE_ADMIN','HOD_UP','ALL_STAFF')),
  finance_approval_threshold NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.organization_settings TO authenticated;
GRANT ALL ON public.organization_settings TO service_role;

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their organization settings"
ON public.organization_settings FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can create their organization settings"
ON public.organization_settings FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update their organization settings"
ON public.organization_settings FOR UPDATE TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER trg_org_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.tg_create_org_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_settings (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_org_settings
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_create_org_settings();

INSERT INTO public.organization_settings (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;