
-- Fix donor_id foreign keys — they incorrectly reference donation_org_profiles
-- (the receiving NPO's own profile). They should reference organization_donors
-- (the actual donor registry the UI selects from).

-- Null out any stale donor_id values that don't exist in organization_donors,
-- so the new FK can be added cleanly.
UPDATE public.purchase_requisitions pr SET donor_id = NULL
  WHERE donor_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.organization_donors d WHERE d.id = pr.donor_id);

UPDATE public.transactions t SET donor_id = NULL
  WHERE donor_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.organization_donors d WHERE d.id = t.donor_id);

UPDATE public.invoices i SET donor_id = NULL
  WHERE donor_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.organization_donors d WHERE d.id = i.donor_id);

UPDATE public.ocr_analyses o SET donor_id = NULL
  WHERE donor_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.organization_donors d WHERE d.id = o.donor_id);

ALTER TABLE public.purchase_requisitions DROP CONSTRAINT IF EXISTS purchase_requisitions_donor_id_fkey;
ALTER TABLE public.purchase_requisitions
  ADD CONSTRAINT purchase_requisitions_donor_id_fkey
  FOREIGN KEY (donor_id) REFERENCES public.organization_donors(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_donor_id_fkey;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_donor_id_fkey
  FOREIGN KEY (donor_id) REFERENCES public.organization_donors(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_donor_id_fkey;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_donor_id_fkey
  FOREIGN KEY (donor_id) REFERENCES public.organization_donors(id) ON DELETE SET NULL;

ALTER TABLE public.ocr_analyses DROP CONSTRAINT IF EXISTS ocr_analyses_donor_id_fkey;
ALTER TABLE public.ocr_analyses
  ADD CONSTRAINT ocr_analyses_donor_id_fkey
  FOREIGN KEY (donor_id) REFERENCES public.organization_donors(id) ON DELETE SET NULL;
