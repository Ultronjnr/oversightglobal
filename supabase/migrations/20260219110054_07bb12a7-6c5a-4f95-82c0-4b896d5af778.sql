
-- Step 1: Delete duplicate quote requests first, keeping only the oldest per (pr_id, supplier_id)
DELETE FROM public.quote_requests
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY pr_id, supplier_id
        ORDER BY created_at ASC
      ) AS rn
    FROM public.quote_requests
  ) ranked
  WHERE rn > 1
);

-- Step 2: Now add the unique constraint to prevent future duplicates
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_pr_supplier_unique
  UNIQUE (pr_id, supplier_id);
