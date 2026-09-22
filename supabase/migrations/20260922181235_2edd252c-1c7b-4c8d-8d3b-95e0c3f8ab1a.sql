DO $$
DECLARE v_pr uuid := '8add6280-ec23-4e33-b1cc-ec81defd4184';
        v_txn uuid := 'd82c9ea9-9163-44fd-8d01-906437727e92';
        v_batch uuid := 'ee525083-a199-4b6c-a0b4-93206ec5e4b6';
BEGIN
  DELETE FROM public.payment_audit_log WHERE batch_id = v_batch;
  DELETE FROM public.payment_allocations WHERE batch_id = v_batch;
  DELETE FROM public.payment_batches WHERE id = v_batch;
  DELETE FROM public.transaction_events WHERE pr_id = v_pr OR transaction_id = v_txn;
  DELETE FROM public.invoices WHERE pr_id = v_pr;
  DELETE FROM public.quotes WHERE pr_id = v_pr;
  UPDATE public.purchase_requisitions SET transaction_id = transaction_id WHERE id = v_pr;
  DELETE FROM public.transactions WHERE id = v_txn;
  DELETE FROM public.purchase_requisitions WHERE id = v_pr;
  DELETE FROM public.suppliers WHERE company_name IN ('Beta Supplies E2E','Alpha Trading E2E');
END $$;