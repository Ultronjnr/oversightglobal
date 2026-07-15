-- 1. pr_message_attachments: add org scope to INSERT policy
DROP POLICY IF EXISTS "Users can attach files to their own messages" ON public.pr_message_attachments;
CREATE POLICY "Users can attach files to their own messages"
ON public.pr_message_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pr_messages m
    JOIN public.purchase_requisitions pr ON pr.id = m.pr_id
    WHERE m.id = pr_message_attachments.message_id
      AND m.sender_id = auth.uid()
      AND pr.organization_id = public.get_user_organization(auth.uid())
  )
);

-- 2. subscription_plans: remove misleading redundant admin-scoped SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view non-public plans" ON public.subscription_plans;

-- 3. Tighten is_valid_self_role_assignment
CREATE OR REPLACE FUNCTION public.is_valid_self_role_assignment(_role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF _role = 'EMPLOYEE' THEN
    RETURN TRUE;
  END IF;

  IF _role = 'SUPPLIER' THEN
    SELECT email INTO _email FROM public.profiles WHERE id = auth.uid();
    IF _email IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Only allow if there is a strictly PENDING (not yet accepted), unexpired
    -- invitation for this exact email, AND no other user already holds a
    -- SUPPLIER role that was granted to this email (i.e. the invitation
    -- hasn't already been consumed by someone else).
    RETURN (
      EXISTS (
        SELECT 1 FROM public.supplier_invitations
        WHERE LOWER(email) = LOWER(_email)
          AND status IN ('PENDING','pending')
          AND expires_at > now()
      )
      OR EXISTS (
        SELECT 1 FROM public.invitations
        WHERE LOWER(email) = LOWER(_email)
          AND role = 'SUPPLIER'
          AND status = 'pending'
          AND expires_at > now()
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'SUPPLIER'
        AND LOWER(p.email) = LOWER(_email)
        AND ur.user_id <> auth.uid()
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- 4. Revoke EXECUTE from anon and authenticated on internal SECURITY DEFINER
-- helpers that should only run from triggers, cron or the service role.
DO $$
DECLARE
  _sig text;
  _sigs text[] := ARRAY[
    -- trigger functions
    'public.tg_quote_request_attach_transaction()',
    'public.tg_quote_attach_transaction()',
    'public.tg_invoice_attach_transaction()',
    'public.tg_payment_allocation_attach_transaction()',
    'public.tg_receipt_attach_transaction()',
    'public.tg_pr_ensure_transaction()',
    'public.tg_te_invoice()',
    'public.tg_te_quote()',
    'public.tg_te_transaction()',
    'public.tg_te_allocation()',
    'public.tg_te_pr()',
    'public.tg_invoice_notifications()',
    'public.tg_create_transaction_on_finance_approval()',
    'public.tg_payment_supplier_notify()',
    'public.tg_payment_alloc_notifications()',
    'public.tg_invoice_fold_into_transaction()',
    'public.tg_batch_notifications()',
    'public.tg_quote_request_supplier_notify()',
    'public.tg_quote_accepted_supplier_notify()',
    'public.tg_reimbursement_notifications()',
    'public.tg_pr_notifications()',
    'public.tg_quote_notifications()',
    'public.tg_transaction_settle_invoice()',
    'public.tg_normalize_receipt_item()',
    -- internal notification helpers
    'public._notify_users(uuid[], uuid, notification_type, text, text, text)',
    'public._notify_supplier(uuid, uuid, notification_type, text, text, text)',
    'public._notify_role(app_role, uuid, notification_type, text, text, text)',
    -- utility / queue helpers
    'public.hash_invitation_token()',
    'public.prevent_accepted_quote_changes()',
    'public.sync_allocation_pool()',
    'public.sync_donation_pool()',
    'public.enforce_freemium_doc_limits()',
    'public.recompute_overdue_invoices()',
    'public.assign_supplier_code()',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.read_email_batch(text, integer, integer)',
    'public.delete_email(text, bigint)',
    'public.enqueue_email(text, jsonb)',
    'public.log_transaction_event(uuid, uuid, uuid, text, text, text, text, text, text)',
    'public.assign_invitation_role(uuid, app_role)',
    'public.attach_batch_export_pdf(uuid, uuid, text)',
    'public.register_batch_export(uuid)',
    'public.next_donation_receipt_number(uuid)',
    'public.email_queue_dispatch()',
    'public.email_queue_wake()'
  ];
BEGIN
  FOREACH _sig IN ARRAY _sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', _sig);
  END LOOP;
END $$;

-- Also revoke anon EXECUTE (keep authenticated) on RPC-facing helpers that
-- must remain callable from the app by signed-in users only.
REVOKE EXECUTE ON FUNCTION public.is_valid_self_role_assignment(app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_supplier_linked_to_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.supplier_current_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.supplier_current_verified(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.organization_has_active_hod(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.organization_has_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;