-- Enums
DO $$ BEGIN
  CREATE TYPE public.company_type AS ENUM ('PTY_LTD', 'PLC', 'NPO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vat_cycle AS ENUM ('MONTHLY', 'BI_MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.freemium_business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  company_name text NOT NULL,
  registration_number text NOT NULL,
  company_type public.company_type NOT NULL,
  vat_registered boolean NOT NULL DEFAULT false,
  vat_number text,
  vat_cycle public.vat_cycle,
  next_vat_submission_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freemium_business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own business profile"
  ON public.freemium_business_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own business profile"
  ON public.freemium_business_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own business profile"
  ON public.freemium_business_profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE TRIGGER trg_freemium_biz_updated_at
  BEFORE UPDATE ON public.freemium_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();