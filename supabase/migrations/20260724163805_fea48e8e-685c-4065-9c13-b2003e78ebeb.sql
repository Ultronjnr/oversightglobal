
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS item_prices JSONB,
  ADD COLUMN IF NOT EXISTS counter_offer_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS counter_offer_notes TEXT,
  ADD COLUMN IF NOT EXISTS counter_offer_by UUID,
  ADD COLUMN IF NOT EXISTS counter_offer_at TIMESTAMPTZ;

-- Allow the supplier who owns a quote to update it when Finance has sent a counter-offer,
-- so they can accept (setting amount) or reject the counter.
DROP POLICY IF EXISTS "Suppliers can respond to counter offers" ON public.quotes;
CREATE POLICY "Suppliers can respond to counter offers"
ON public.quotes FOR UPDATE
TO authenticated
USING (
  supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
)
WITH CHECK (
  supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
);
