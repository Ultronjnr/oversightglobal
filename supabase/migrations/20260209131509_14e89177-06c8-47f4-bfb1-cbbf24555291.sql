
-- Allow newly signed-up suppliers to insert their own record
CREATE POLICY "Suppliers can insert own record"
ON public.suppliers
FOR INSERT
WITH CHECK (user_id = auth.uid());
