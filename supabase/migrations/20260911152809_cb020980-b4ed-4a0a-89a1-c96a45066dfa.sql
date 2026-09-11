CREATE OR REPLACE FUNCTION public.link_recent_ocr_analysis_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ocr_analyses oa
  SET pr_id = NEW.pr_id,
      updated_at = now()
  WHERE NEW.pr_id IS NOT NULL
    AND oa.pr_id IS NULL
    AND oa.organization_id = NEW.organization_id
    AND oa.status = 'COMPLETED'
    AND oa.created_at BETWEEN NEW.created_at - interval '20 minutes' AND NEW.created_at + interval '5 minutes'
    AND lower(trim(coalesce(oa.extracted->>'supplier_name', ''))) = lower(trim(coalesce(NEW.supplier_name, '')))
    AND abs(coalesce((oa.extracted->>'total_amount')::numeric, -1) - coalesce(NEW.amount, -2)) < 0.01;
  RETURN NEW;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_recent_ocr_analysis_after_transaction ON public.transactions;
CREATE TRIGGER link_recent_ocr_analysis_after_transaction
AFTER INSERT OR UPDATE OF pr_id ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.link_recent_ocr_analysis_to_transaction();

UPDATE public.ocr_analyses oa
SET pr_id = matched.pr_id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (source.id) source.id AS analysis_id, t.pr_id
  FROM public.ocr_analyses source
  JOIN public.transactions t
    ON t.pr_id IS NOT NULL
   AND t.organization_id = source.organization_id
   AND t.created_at BETWEEN source.created_at - interval '5 minutes' AND source.created_at + interval '20 minutes'
   AND lower(trim(coalesce(t.supplier_name, ''))) = lower(trim(coalesce(source.extracted->>'supplier_name', '')))
   AND abs(coalesce(t.amount, -2) - coalesce((source.extracted->>'total_amount')::numeric, -1)) < 0.01
  WHERE source.pr_id IS NULL
    AND source.status = 'COMPLETED'
  ORDER BY source.id, abs(extract(epoch from (t.created_at - source.created_at)))
) matched
WHERE oa.id = matched.analysis_id;