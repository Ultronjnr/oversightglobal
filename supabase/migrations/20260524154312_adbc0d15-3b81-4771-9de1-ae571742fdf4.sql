CREATE OR REPLACE FUNCTION public.is_valid_self_role_assignment(_role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    RETURN EXISTS (
      SELECT 1 FROM public.invitations
      WHERE LOWER(email) = LOWER(_email)
        AND role = 'SUPPLIER'
        AND status IN ('pending','accepted')
        AND expires_at > now() - interval '30 days'
    );
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_reimbursement_comment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_reimbursement(text, numeric, text, text, text, uuid, text, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_supplier_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_normalize_receipt_item() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_create_transaction_on_finance_approval() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.add_reimbursement_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_reimbursement(text, numeric, text, text, text, uuid, text, date, text) TO authenticated;