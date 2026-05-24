
DO $$ BEGIN
  CREATE TYPE public.supplier_type AS ENUM ('REGISTERED', 'PREFERRED', 'ONE_TIME');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS supplier_type public.supplier_type NOT NULL DEFAULT 'REGISTERED',
  ADD COLUMN IF NOT EXISTS supplier_code text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.assign_supplier_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq int;
BEGIN
  IF NEW.supplier_code IS NULL OR length(trim(NEW.supplier_code)) = 0 THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(supplier_code, '^SUP-', ''), '')::int), 0) + 1
      INTO next_seq
      FROM public.suppliers
     WHERE organization_id = NEW.organization_id
       AND supplier_code ~ '^SUP-[0-9]+$';
    NEW.supplier_code := 'SUP-' || lpad(next_seq::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS suppliers_assign_code ON public.suppliers;
CREATE TRIGGER suppliers_assign_code
BEFORE INSERT ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.assign_supplier_code();

-- Backfill existing rows missing a code (per-org sequential)
DO $$
DECLARE r record; s record; n int;
BEGIN
  FOR r IN SELECT DISTINCT organization_id FROM public.suppliers WHERE supplier_code IS NULL LOOP
    SELECT COALESCE(MAX(NULLIF(regexp_replace(supplier_code, '^SUP-', ''), '')::int), 0)
      INTO n FROM public.suppliers
      WHERE organization_id = r.organization_id AND supplier_code ~ '^SUP-[0-9]+$';
    FOR s IN SELECT id FROM public.suppliers
              WHERE organization_id = r.organization_id AND supplier_code IS NULL
              ORDER BY created_at LOOP
      n := n + 1;
      UPDATE public.suppliers SET supplier_code = 'SUP-' || lpad(n::text, 5, '0') WHERE id = s.id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_org_code_unique
  ON public.suppliers (organization_id, supplier_code);
