DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organisation_type') THEN
    CREATE TYPE public.organisation_type AS ENUM ('NGO', 'NPO');
  END IF;
END $$;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS organisation_type public.organisation_type,
  ADD COLUMN IF NOT EXISTS pbo_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pbo_number text;

ALTER TABLE public.organization_onboarding
  ADD COLUMN IF NOT EXISTS pain_point_other text,
  ADD COLUMN IF NOT EXISTS cause_other text,
  ADD COLUMN IF NOT EXISTS heard_about_other text,
  ADD COLUMN IF NOT EXISTS funding text,
  ADD COLUMN IF NOT EXISTS funding_other text;