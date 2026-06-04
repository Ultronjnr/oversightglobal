DELETE FROM public.user_roles ur
USING public.suppliers s
WHERE ur.user_id = s.user_id
  AND ur.role = 'EMPLOYEE'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id AND ur2.role = 'SUPPLIER'
  );