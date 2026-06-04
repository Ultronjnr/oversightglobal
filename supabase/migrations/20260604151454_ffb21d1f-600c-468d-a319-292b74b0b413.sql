ALTER TABLE public.payment_batches
  ADD COLUMN IF NOT EXISTS export_id uuid,
  ADD COLUMN IF NOT EXISTS exported_at timestamptz,
  ADD COLUMN IF NOT EXISTS exported_by uuid;

CREATE TABLE IF NOT EXISTS public.batch_export_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.payment_batches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  export_id uuid NOT NULL,
  file_path text,
  exported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.batch_export_log TO authenticated;
GRANT ALL ON public.batch_export_log TO service_role;

ALTER TABLE public.batch_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view batch export log in their org"
ON public.batch_export_log FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'FINANCE'::app_role) OR public.has_role(auth.uid(), 'ADMIN'::app_role))
);

CREATE OR REPLACE FUNCTION public.register_batch_export(_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _batch record;
  _export_id uuid;
  _file_path text;
  _already boolean := false;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can export payment batches');
  END IF;
  _org_id := get_user_organization(_user_id);

  SELECT * INTO _batch FROM public.payment_batches
  WHERE id = _batch_id AND organization_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batch not found');
  END IF;

  IF _batch.export_id IS NOT NULL THEN
    -- Prevent duplicate export: reuse existing locked Export ID
    SELECT file_path INTO _file_path FROM public.batch_export_log
    WHERE batch_id = _batch_id AND export_id = _batch.export_id
    ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object(
      'success', true,
      'export_id', _batch.export_id,
      'already_exported', true,
      'exported_at', _batch.exported_at,
      'file_path', _file_path
    );
  END IF;

  _export_id := gen_random_uuid();

  UPDATE public.payment_batches
  SET export_id = _export_id, exported_at = now(), exported_by = _user_id
  WHERE id = _batch_id;

  INSERT INTO public.batch_export_log (batch_id, organization_id, export_id, exported_by)
  VALUES (_batch_id, _org_id, _export_id, _user_id);

  RETURN jsonb_build_object(
    'success', true,
    'export_id', _export_id,
    'already_exported', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.attach_batch_export_pdf(_batch_id uuid, _export_id uuid, _file_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
BEGIN
  IF NOT has_role(_user_id, 'FINANCE'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Finance can export payment batches');
  END IF;
  _org_id := get_user_organization(_user_id);

  UPDATE public.batch_export_log
  SET file_path = _file_path
  WHERE batch_id = _batch_id AND export_id = _export_id AND organization_id = _org_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;