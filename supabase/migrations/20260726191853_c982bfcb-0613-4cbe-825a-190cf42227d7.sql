DROP POLICY IF EXISTS "Suppliers can view PR messages in their org" ON public.pr_messages;
CREATE POLICY "Suppliers can view PR messages in their org"
ON public.pr_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM quote_requests qr
  JOIN suppliers s ON s.id = qr.supplier_id
  JOIN purchase_requisitions pr ON pr.id = qr.pr_id
  WHERE qr.pr_id = pr_messages.pr_id
    AND s.user_id = auth.uid()
    AND s.organization_id = pr_messages.organization_id
    AND pr.status <> 'PENDING_HOD_APPROVAL'::pr_status
));

DROP POLICY IF EXISTS "Suppliers can view PRs for their quote requests" ON public.purchase_requisitions;
CREATE POLICY "Suppliers can view PRs for their quote requests"
ON public.purchase_requisitions FOR SELECT TO authenticated
USING (
  status <> 'PENDING_HOD_APPROVAL'::pr_status
  AND id IN (
    SELECT qr.pr_id FROM quote_requests qr
    JOIN suppliers s ON s.id = qr.supplier_id
    WHERE s.user_id = auth.uid()
  )
);