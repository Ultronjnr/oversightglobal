
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  organisation TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT,
  user_agent TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.contact_submissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX contact_submissions_created_at_idx ON public.contact_submissions (created_at DESC);
