-- Create table for PR chat messages
CREATE TABLE public.pr_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_id UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pr_messages ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups by pr_id
CREATE INDEX idx_pr_messages_pr_id ON public.pr_messages(pr_id);
CREATE INDEX idx_pr_messages_created_at ON public.pr_messages(created_at);

-- Policy: Employees can view messages for their own PRs
CREATE POLICY "Employees can view messages for their PRs"
ON public.pr_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.requested_by = auth.uid()
  )
);

-- Policy: HOD can view messages for PRs in their org (any status)
CREATE POLICY "HOD can view PR messages in their org"
ON public.pr_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'HOD')
  )
);

-- Policy: Finance can view messages for PRs in their org (after HOD stage)
CREATE POLICY "Finance can view PR messages in their org"
ON public.pr_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'FINANCE')
    AND pr.status <> 'PENDING_HOD_APPROVAL'
  )
);

-- Policy: Admin can view all messages in their org
CREATE POLICY "Admin can view all PR messages in their org"
ON public.pr_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'ADMIN')
  )
);

-- Policy: Employees can send messages to their own PRs
CREATE POLICY "Employees can send messages to their PRs"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.requested_by = auth.uid()
  )
);

-- Policy: HOD can send messages to PRs in their org
CREATE POLICY "HOD can send messages to PRs in their org"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND has_role(auth.uid(), 'HOD')
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.organization_id = get_user_organization(auth.uid())
  )
);

-- Policy: Finance can send messages to PRs in their org
CREATE POLICY "Finance can send messages to PRs in their org"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND has_role(auth.uid(), 'FINANCE')
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.organization_id = get_user_organization(auth.uid())
  )
);

-- Policy: Admin can send messages to PRs in their org
CREATE POLICY "Admin can send messages to PRs in their org"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND has_role(auth.uid(), 'ADMIN')
  AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_messages.pr_id
    AND pr.organization_id = get_user_organization(auth.uid())
  )
);

-- NO UPDATE or DELETE policies - messages are immutable