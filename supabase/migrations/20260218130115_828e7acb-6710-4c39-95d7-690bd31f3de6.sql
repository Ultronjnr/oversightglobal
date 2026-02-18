
-- Step 1: Extend pr_messages with missing columns
ALTER TABLE public.pr_messages
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS is_system_note boolean NOT NULL DEFAULT false;

-- Back-fill organization_id from the linked PR
UPDATE public.pr_messages m
SET organization_id = pr.organization_id
FROM public.purchase_requisitions pr
WHERE pr.id = m.pr_id;

-- Make organization_id NOT NULL after back-fill
ALTER TABLE public.pr_messages
  ALTER COLUMN organization_id SET NOT NULL;

-- Step 2: Add index on organization_id
CREATE INDEX IF NOT EXISTS idx_pr_messages_organization_id
  ON public.pr_messages(organization_id);

-- Step 3: Add Supplier RLS policy on pr_messages
CREATE POLICY "Suppliers can view PR messages in their org"
  ON public.pr_messages FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'SUPPLIER'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.quote_requests qr
      JOIN public.suppliers s ON s.id = qr.supplier_id
      WHERE qr.pr_id = pr_messages.pr_id AND s.user_id = auth.uid()
    )
  );

-- Step 4: Create pr_message_attachments table
CREATE TABLE public.pr_message_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES public.pr_messages(id) ON DELETE CASCADE,
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pr_message_attachments ENABLE ROW LEVEL SECURITY;

-- Step 5: Index on message_id
CREATE INDEX idx_pr_message_attachments_message_id
  ON public.pr_message_attachments(message_id);

-- Step 6: RLS policies on pr_message_attachments

-- SELECT: org-scoped via parent PR
CREATE POLICY "Users can view attachments in their org"
  ON public.pr_message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pr_messages m
      JOIN public.purchase_requisitions pr ON pr.id = m.pr_id
      WHERE m.id = pr_message_attachments.message_id
        AND pr.organization_id = get_user_organization(auth.uid())
    )
  );

-- INSERT: user must own the parent message
CREATE POLICY "Users can attach files to their own messages"
  ON public.pr_message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pr_messages m
      WHERE m.id = pr_message_attachments.message_id
        AND m.sender_id = auth.uid()
    )
  );

-- No DELETE policies (audit integrity preserved)
