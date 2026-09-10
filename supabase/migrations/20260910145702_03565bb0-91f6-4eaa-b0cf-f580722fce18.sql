CREATE OR REPLACE FUNCTION public.default_role_permission(_role app_role, _permission text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _role = 'ADMIN' THEN true
    WHEN _role = 'FINANCE' THEN _permission NOT IN (
      'users.invite','users.edit','users.manage_permissions'
    )
    WHEN _role = 'HOD' THEN _permission IN (
      'requisitions.view','requisitions.create','requisitions.edit','requisitions.submit',
      'requisitions.approve','requisitions.decline',
      'transactions.view','expenses.view','expenses.create',
      'invoices.view','invoices.upload',
      'suppliers.view','projects.view','donors.view',
      'reports.view','reports.export','users.view',
      'finance.view'
    )
    WHEN _role = 'EMPLOYEE' THEN _permission IN (
      'requisitions.view','requisitions.create','requisitions.edit','requisitions.submit',
      'expenses.view','expenses.create','invoices.view','invoices.upload',
      'suppliers.view','projects.view','donors.view'
    )
    WHEN _role = 'SUPPLIER' THEN _permission IN (
      'invoices.view','invoices.upload','suppliers.view'
    )
    ELSE false
  END;
$function$;

DROP POLICY IF EXISTS "Permitted staff can view org transactions" ON public.transactions;
CREATE POLICY "Permitted staff can view org transactions"
ON public.transactions FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_permission(auth.uid(), 'finance.view')
);

DROP POLICY IF EXISTS "Permitted staff can view org invoices" ON public.invoices;
CREATE POLICY "Permitted staff can view org invoices"
ON public.invoices FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_permission(auth.uid(), 'finance.view')
);

DROP POLICY IF EXISTS "Permitted staff can view org batches" ON public.payment_batches;
CREATE POLICY "Permitted staff can view org batches"
ON public.payment_batches FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.has_permission(auth.uid(), 'finance.view')
);