DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.subscription_plans;
CREATE POLICY "Public plans viewable by everyone" ON public.subscription_plans FOR SELECT TO public USING (is_public = true AND is_active = true);
CREATE POLICY "Authenticated users can view non-public plans" ON public.subscription_plans FOR SELECT TO authenticated USING (has_role(auth.uid(), 'ADMIN'::app_role));