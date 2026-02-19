
-- Fix: Suppliers cannot view PR messages because their profiles have NULL organization_id.
-- The existing policy uses get_user_organization(auth.uid()) which returns NULL for supplier users.
-- We replace it with a policy that directly uses the suppliers.organization_id column.

DROP POLICY IF EXISTS "Suppliers can view PR messages in their org" ON public.pr_messages;

CREATE POLICY "Suppliers can view PR messages in their org"
ON public.pr_messages
FOR SELECT
USING (
  -- The supplier must have an active/pending quote request on this PR
  EXISTS (
    SELECT 1
    FROM quote_requests qr
    JOIN suppliers s ON s.id = qr.supplier_id
    WHERE qr.pr_id = pr_messages.pr_id
      AND s.user_id = auth.uid()
      -- org-scope via the supplier record (not profile, which can be NULL for supplier users)
      AND s.organization_id = pr_messages.organization_id
  )
);

-- Also fix the INSERT policy for suppliers sending messages to PRs
-- (they may also need to send messages, not just read)
DROP POLICY IF EXISTS "Suppliers can send messages to their PRs" ON public.pr_messages;

CREATE POLICY "Suppliers can send messages to their PRs"
ON public.pr_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND has_role(auth.uid(), 'SUPPLIER'::app_role)
  AND EXISTS (
    SELECT 1
    FROM quote_requests qr
    JOIN suppliers s ON s.id = qr.supplier_id
    WHERE qr.pr_id = pr_messages.pr_id
      AND s.user_id = auth.uid()
      AND s.organization_id = pr_messages.organization_id
  )
);
