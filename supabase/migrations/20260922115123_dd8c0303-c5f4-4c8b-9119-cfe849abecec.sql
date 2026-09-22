-- Records an invoice captured internally (one-person / no supplier portal user)
-- against the already selected quote, keeping the quote -> supplier link intact.
CREATE OR REPLACE FUNCTION public.record_internal_invoice(
  _pr_id uuid,
  _quote_id uuid,
  _document_url text,
  _invoice_supplier_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_quote RECORD;
  v_supplier_id uuid;
  v_supplier_name text;
  v_invoice_id uuid;
  v_existing uuid;
  v_mismatch boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id AND pr_id = _pr_id;
  IF v_quote IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected quote not found for this requisition');
  END IF;

  v_org := v_quote.organization_id;

  IF public.get_user_organization(v_user) IS DISTINCT FROM v_org
     OR NOT (public.has_role(v_user, 'ADMIN') OR public.has_role(v_user, 'FINANCE')
             OR public.can_act_as_finance(v_user)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not allowed to record invoices for this organisation');
  END IF;

  IF v_quote.status NOT IN ('ACCEPTED', 'INVOICE_UPLOADED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Select the winning quote before recording the invoice');
  END IF;

  SELECT id INTO v_existing FROM public.invoices WHERE quote_id = _quote_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'An invoice has already been recorded for this quote');
  END IF;

  -- Make sure the quote is bound to a real supplier record.
  v_supplier_id := v_quote.supplier_id;
  IF v_supplier_id IS NULL THEN
    v_supplier_name := COALESCE(NULLIF(btrim(v_quote.supplier_name), ''), 'Unnamed supplier');

    SELECT id INTO v_supplier_id
    FROM public.suppliers
    WHERE organization_id = v_org AND lower(company_name) = lower(v_supplier_name)
    LIMIT 1;

    IF v_supplier_id IS NULL THEN
      INSERT INTO public.suppliers (company_name, organization_id, is_manual, created_by, supplier_type)
      VALUES (v_supplier_name, v_org, true, v_user, 'ONE_TIME')
      RETURNING id INTO v_supplier_id;
    END IF;

    UPDATE public.quotes SET supplier_id = v_supplier_id WHERE id = _quote_id;
  END IF;

  SELECT company_name INTO v_supplier_name FROM public.suppliers WHERE id = v_supplier_id;

  IF _invoice_supplier_name IS NOT NULL AND btrim(_invoice_supplier_name) <> ''
     AND lower(btrim(_invoice_supplier_name)) <> lower(coalesce(v_supplier_name, '')) THEN
    v_mismatch := true;
  END IF;

  INSERT INTO public.invoices (quote_id, pr_id, supplier_id, organization_id, transaction_id, document_url, status)
  VALUES (_quote_id, _pr_id, v_supplier_id, v_org, v_quote.transaction_id, _document_url, 'UPLOADED')
  RETURNING id INTO v_invoice_id;

  UPDATE public.quotes SET status = 'INVOICE_UPLOADED' WHERE id = _quote_id;

  UPDATE public.purchase_requisitions
  SET history = coalesce(history, '[]'::jsonb) || jsonb_build_object(
        'action', 'INVOICE_RECORDED',
        'user_id', v_user,
        'user_name', 'Authorised user',
        'timestamp', now(),
        'details', 'Actual invoice recorded against the selected quote from ' || coalesce(v_supplier_name, 'the selected supplier')
          || CASE WHEN v_mismatch THEN ' (supplier on the invoice differs from the selected supplier)' ELSE '' END
      )
  WHERE id = _pr_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'supplier_id', v_supplier_id,
    'supplier_name', v_supplier_name,
    'supplier_mismatch', v_mismatch
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_internal_invoice(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_internal_invoice(uuid, uuid, text, text) TO authenticated;