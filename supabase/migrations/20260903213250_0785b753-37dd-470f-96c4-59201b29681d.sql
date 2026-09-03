CREATE TABLE public.organization_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pain_point text,
  cause text,
  team_size text,
  heard_about text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.organization_onboarding TO authenticated;
GRANT ALL ON public.organization_onboarding TO service_role;

ALTER TABLE public.organization_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read onboarding"
ON public.organization_onboarding FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "org members create onboarding"
ON public.organization_onboarding FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "org members update onboarding"
ON public.organization_onboarding FOR UPDATE TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));