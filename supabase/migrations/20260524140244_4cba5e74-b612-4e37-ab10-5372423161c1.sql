-- 1. Receipts table (raw + processed safe)
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL,

  store_name TEXT,
  invoice_number TEXT,
  receipt_date TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'ZAR',

  -- Raw OCR output (NEVER FAIL)
  raw_text TEXT,
  raw_json JSONB,

  -- Computed totals (never required)
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,

  -- Source linkage (optional)
  source_bucket TEXT,
  source_path TEXT,
  ocr_analysis_id UUID,

  status TEXT NOT NULL DEFAULT 'pending_ocr',
  -- pending_ocr | processed | validated | flagged

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT receipts_status_check CHECK (status IN ('pending_ocr','processed','validated','flagged'))
);

CREATE INDEX idx_receipts_org ON public.receipts(organization_id);
CREATE INDEX idx_receipts_status ON public.receipts(status);

-- 2. Receipt items table — permissive
CREATE TABLE public.receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,

  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,

  -- Permissive: unit_price may be missing
  unit_price NUMERIC,
  total NUMERIC NOT NULL DEFAULT 0,

  -- System-calculated fields
  calculated_unit_price NUMERIC,
  calculated_total NUMERIC,

  -- Soft validation
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  warning TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT receipt_items_total_nonneg CHECK (total >= 0),
  CONSTRAINT receipt_items_qty_nonneg CHECK (quantity >= 0)
);

CREATE INDEX idx_receipt_items_receipt ON public.receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_org ON public.receipt_items(organization_id);

-- 3. Audit log
CREATE TABLE public.receipt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  message TEXT,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipt_audit_receipt ON public.receipt_audit_log(receipt_id);

-- 4. Normalization trigger — never blocks insert
CREATE OR REPLACE FUNCTION public.tg_normalize_receipt_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _qty NUMERIC;
  _unit NUMERIC;
  _total NUMERIC;
  _warn TEXT := NULL;
  _valid BOOLEAN := TRUE;
BEGIN
  _qty := COALESCE(NEW.quantity, 1);
  IF _qty <= 0 THEN
    _qty := 1;
    _warn := 'Quantity missing or invalid — defaulted to 1';
    _valid := FALSE;
  END IF;
  NEW.quantity := _qty;

  _unit := NEW.unit_price;
  _total := COALESCE(NEW.total, 0);

  -- Derive unit from total
  IF _unit IS NULL AND _total > 0 AND _qty > 0 THEN
    _unit := ROUND(_total / _qty, 2);
    _warn := COALESCE(_warn || ' | ', '') || 'Unit price calculated from total ÷ quantity';
  END IF;

  -- Derive total from unit
  IF (_total IS NULL OR _total = 0) AND _unit IS NOT NULL THEN
    _total := ROUND(_unit * _qty, 2);
    NEW.total := _total;
    _warn := COALESCE(_warn || ' | ', '') || 'Total calculated from unit × quantity';
  END IF;

  -- Consistency check
  IF _unit IS NOT NULL AND _total > 0 THEN
    IF ABS((_unit * _qty) - _total) > 0.05 THEN
      _warn := COALESCE(_warn || ' | ', '') || 'Math mismatch: unit × qty ≠ total';
      _valid := FALSE;
    END IF;
  END IF;

  NEW.calculated_unit_price := _unit;
  NEW.calculated_total := CASE WHEN _unit IS NOT NULL THEN ROUND(_unit * _qty, 2) ELSE _total END;
  NEW.warning := _warn;
  NEW.is_valid := _valid AND (_unit IS NOT NULL);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_receipt_item
BEFORE INSERT OR UPDATE ON public.receipt_items
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_receipt_item();

CREATE TRIGGER trg_receipts_updated_at
BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Clean view for finance consumption
CREATE VIEW public.clean_receipt_items
WITH (security_invoker = true)
AS
SELECT
  id,
  receipt_id,
  organization_id,
  item_name,
  quantity,
  COALESCE(unit_price, calculated_unit_price) AS unit_price,
  total,
  is_valid,
  warning,
  created_at
FROM public.receipt_items;

-- 6. RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_audit_log ENABLE ROW LEVEL SECURITY;

-- Receipts policies
CREATE POLICY "Finance/Admin view org receipts" ON public.receipts
FOR SELECT USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin insert org receipts" ON public.receipts
FOR INSERT WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND created_by = auth.uid()
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin update org receipts" ON public.receipts
FOR UPDATE USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

-- Receipt items policies
CREATE POLICY "Finance/Admin view org receipt items" ON public.receipt_items
FOR SELECT USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin insert org receipt items" ON public.receipt_items
FOR INSERT WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin update org receipt items" ON public.receipt_items
FOR UPDATE USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

-- Audit log policies (insert + view, no update/delete)
CREATE POLICY "Finance/Admin view org receipt audit" ON public.receipt_audit_log
FOR SELECT USING (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE POLICY "Finance/Admin insert org receipt audit" ON public.receipt_audit_log
FOR INSERT WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
);