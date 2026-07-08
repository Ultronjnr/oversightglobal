
-- ===== Enums =====
DO $$ BEGIN
  CREATE TYPE public.donor_type AS ENUM ('INDIVIDUAL', 'ORGANIZATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.donation_type AS ENUM ('CASH', 'IN_KIND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.receipt_status AS ENUM ('DRAFT', 'ISSUED', 'EMAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.allocation_type AS ENUM ('RESERVED', 'SPENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.allocation_source AS ENUM ('MANUAL', 'EXPENSE', 'TRANSACTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Shared updated_at trigger fn (idempotent) =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Helper: is the current user admin or finance
CREATE OR REPLACE FUNCTION public.is_donation_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'ADMIN') OR public.has_role(_user_id, 'FINANCE');
$$;

-- ============================================================
-- organization_donors (Master Donor Registry)
-- ============================================================
CREATE TABLE public.organization_donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donor_type public.donor_type NOT NULL DEFAULT 'INDIVIDUAL',
  name text NOT NULL,
  id_or_reg_number text,
  income_tax_number text,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_donors TO authenticated;
GRANT ALL ON public.organization_donors TO service_role;
ALTER TABLE public.organization_donors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers manage donors in their org"
ON public.organization_donors FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE TRIGGER trg_donors_updated BEFORE UPDATE ON public.organization_donors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- donor_funding_pools
-- ============================================================
CREATE TABLE public.donor_funding_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.organization_donors(id) ON DELETE CASCADE,
  total_donated numeric NOT NULL DEFAULT 0,
  total_allocated numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (donor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donor_funding_pools TO authenticated;
GRANT ALL ON public.donor_funding_pools TO service_role;
ALTER TABLE public.donor_funding_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers manage pools in their org"
ON public.donor_funding_pools FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE TRIGGER trg_pools_updated BEFORE UPDATE ON public.donor_funding_pools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a pool when a donor is created
CREATE OR REPLACE FUNCTION public.create_donor_pool()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.donor_funding_pools (organization_id, donor_id)
  VALUES (NEW.organization_id, NEW.id)
  ON CONFLICT (donor_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_create_donor_pool AFTER INSERT ON public.organization_donors
FOR EACH ROW EXECUTE FUNCTION public.create_donor_pool();

-- ============================================================
-- donation_projects
-- ============================================================
CREATE TABLE public.donation_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  status text NOT NULL DEFAULT 'ACTIVE',
  budget numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_projects TO authenticated;
GRANT ALL ON public.donation_projects TO service_role;
ALTER TABLE public.donation_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers manage projects in their org"
ON public.donation_projects FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.donation_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- donations
-- ============================================================
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.organization_donors(id) ON DELETE CASCADE,
  donation_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  donation_type public.donation_type NOT NULL DEFAULT 'CASH',
  description text,
  in_kind_value numeric,
  receipt_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers manage donations in their org"
ON public.donations FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE TRIGGER trg_donations_updated BEFORE UPDATE ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Maintain pool.total_donated
CREATE OR REPLACE FUNCTION public.sync_donation_pool()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _donor uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN _donor := OLD.donor_id; ELSE _donor := NEW.donor_id; END IF;
  UPDATE public.donor_funding_pools p
  SET total_donated = COALESCE((SELECT SUM(amount) FROM public.donations d WHERE d.donor_id = _donor), 0)
  WHERE p.donor_id = _donor;
  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER trg_sync_donation_pool
AFTER INSERT OR UPDATE OR DELETE ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.sync_donation_pool();

-- ============================================================
-- fund_allocations
-- ============================================================
CREATE TABLE public.fund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.organization_donors(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.donor_funding_pools(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.donation_projects(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  allocation_type public.allocation_type NOT NULL DEFAULT 'RESERVED',
  source_type public.allocation_source NOT NULL DEFAULT 'MANUAL',
  source_id uuid,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_allocations TO authenticated;
GRANT ALL ON public.fund_allocations TO service_role;
ALTER TABLE public.fund_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers manage allocations in their org"
ON public.fund_allocations FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE TRIGGER trg_allocations_updated BEFORE UPDATE ON public.fund_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Maintain pool allocated/spent
CREATE OR REPLACE FUNCTION public.sync_allocation_pool()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _donor uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN _donor := OLD.donor_id; ELSE _donor := NEW.donor_id; END IF;
  UPDATE public.donor_funding_pools p
  SET total_allocated = COALESCE((SELECT SUM(amount) FROM public.fund_allocations a WHERE a.donor_id = _donor AND a.allocation_type = 'RESERVED'), 0),
      total_spent = COALESCE((SELECT SUM(amount) FROM public.fund_allocations a WHERE a.donor_id = _donor AND a.allocation_type = 'SPENT'), 0)
  WHERE p.donor_id = _donor;
  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER trg_sync_allocation_pool
AFTER INSERT OR UPDATE OR DELETE ON public.fund_allocations
FOR EACH ROW EXECUTE FUNCTION public.sync_allocation_pool();

-- ============================================================
-- donation_org_profiles
-- ============================================================
CREATE TABLE public.donation_org_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_name text,
  npo_number text,
  pbo_number text,
  vat_number text,
  registration_number text,
  physical_address text,
  postal_address text,
  contact_name text,
  contact_email text,
  contact_phone text,
  signatory_name text,
  signatory_designation text,
  logo_path text,
  signature_path text,
  stamp_path text,
  receipt_prefix text NOT NULL DEFAULT '18A',
  next_receipt_number integer NOT NULL DEFAULT 1,
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_org_profiles TO authenticated;
GRANT ALL ON public.donation_org_profiles TO service_role;
ALTER TABLE public.donation_org_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers manage org profile"
ON public.donation_org_profiles FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE TRIGGER trg_donprofile_updated BEFORE UPDATE ON public.donation_org_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- donation_receipts (versioned)
-- ============================================================
CREATE TABLE public.donation_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  donation_id uuid REFERENCES public.donations(id) ON DELETE SET NULL,
  donor_id uuid REFERENCES public.organization_donors(id) ON DELETE SET NULL,
  issued_at timestamptz,
  status public.receipt_status NOT NULL DEFAULT 'DRAFT',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path text,
  version integer NOT NULL DEFAULT 1,
  verification_hash text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_receipts TO authenticated;
GRANT ALL ON public.donation_receipts TO service_role;
-- allow public/anon SELECT for the online verification page (read-only, by id + hash)
GRANT SELECT ON public.donation_receipts TO anon;
ALTER TABLE public.donation_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers manage receipts in their org"
ON public.donation_receipts FOR ALL TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE TRIGGER trg_receipts_updated BEFORE UPDATE ON public.donation_receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public verification via SECURITY DEFINER function (no broad table exposure needed beyond id+hash)
CREATE OR REPLACE FUNCTION public.verify_donation_receipt(_id uuid, _hash text)
RETURNS TABLE (receipt_number text, status public.receipt_status, issued_at timestamptz, snapshot jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.receipt_number, r.status, r.issued_at, r.snapshot
  FROM public.donation_receipts r
  WHERE r.id = _id AND r.verification_hash = _hash AND r.status IN ('ISSUED','EMAILED');
$$;
GRANT EXECUTE ON FUNCTION public.verify_donation_receipt(uuid, text) TO anon, authenticated;

-- Atomic receipt numbering
CREATE OR REPLACE FUNCTION public.next_donation_receipt_number(_org_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text; _num integer;
BEGIN
  INSERT INTO public.donation_org_profiles (organization_id)
  VALUES (_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.donation_org_profiles
  SET next_receipt_number = next_receipt_number + 1
  WHERE organization_id = _org_id
  RETURNING receipt_prefix, next_receipt_number - 1 INTO _prefix, _num;

  RETURN _prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(_num::text, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_donation_receipt_number(uuid) TO authenticated, service_role;

-- ============================================================
-- donation_audit_log
-- ============================================================
CREATE TABLE public.donation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.donation_audit_log TO authenticated;
GRANT ALL ON public.donation_audit_log TO service_role;
ALTER TABLE public.donation_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation managers read audit in their org"
ON public.donation_audit_log FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
CREATE POLICY "Donation managers write audit in their org"
ON public.donation_audit_log FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_organization(auth.uid()) AND public.is_donation_manager(auth.uid()));
