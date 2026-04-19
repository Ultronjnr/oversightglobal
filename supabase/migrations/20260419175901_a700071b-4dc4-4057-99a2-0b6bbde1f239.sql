-- Table to track freemium uploads
CREATE TABLE IF NOT EXISTS public.freemium_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  description text,
  upload_date timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freemium_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own freemium docs"
  ON public.freemium_documents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own freemium docs"
  ON public.freemium_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own freemium docs"
  ON public.freemium_documents FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_freemium_docs_user_date
  ON public.freemium_documents(user_id, upload_date DESC);

-- Enforce 50 total / 3 per day limit
CREATE OR REPLACE FUNCTION public.enforce_freemium_doc_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count int;
  today_count int;
BEGIN
  SELECT count(*) INTO total_count
  FROM public.freemium_documents
  WHERE user_id = NEW.user_id;

  IF total_count >= 50 THEN
    RAISE EXCEPTION 'Upload limit reached. Upgrade to continue.';
  END IF;

  SELECT count(*) INTO today_count
  FROM public.freemium_documents
  WHERE user_id = NEW.user_id
    AND upload_date >= (now() - interval '24 hours');

  IF today_count >= 3 THEN
    RAISE EXCEPTION 'Upload limit reached. Upgrade to continue.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_freemium_doc_limits ON public.freemium_documents;
CREATE TRIGGER trg_enforce_freemium_doc_limits
  BEFORE INSERT ON public.freemium_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_freemium_doc_limits();

-- Private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('freemium-documents', 'freemium-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users only access their own folder (user_id/...)
CREATE POLICY "Users read own freemium files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'freemium-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own freemium files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'freemium-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own freemium files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'freemium-documents' AND auth.uid()::text = (storage.foldername(name))[1]);