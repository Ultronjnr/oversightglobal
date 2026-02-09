
-- Backfill orphaned suppliers using their quote_request history
-- This links each supplier to the organization they first interacted with
UPDATE public.suppliers s
SET organization_id = sub.org_id
FROM (
  SELECT DISTINCT ON (qr.supplier_id) qr.supplier_id, qr.organization_id AS org_id
  FROM public.quote_requests qr
  WHERE qr.supplier_id IN (
    SELECT id FROM public.suppliers WHERE organization_id IS NULL
  )
  ORDER BY qr.supplier_id, qr.created_at ASC
) sub
WHERE s.id = sub.supplier_id
AND s.organization_id IS NULL;

-- For any remaining suppliers with no connections, assign to the first organization
-- (these are orphan test data with no quote requests)
UPDATE public.suppliers
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1)
WHERE organization_id IS NULL;

-- Now enforce NOT NULL constraint on organization_id
ALTER TABLE public.suppliers
ALTER COLUMN organization_id SET NOT NULL;
