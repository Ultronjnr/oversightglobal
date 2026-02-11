
-- Add permissive authentication-required SELECT policies to ensure
-- unauthenticated users cannot access these tables.
-- These work WITH existing restrictive policies:
-- Permissive (OR): at least one must match → auth required
-- Restrictive (AND): all must match → org scoping enforced

-- profiles: require authentication for SELECT
CREATE POLICY "Authenticated users only"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- suppliers: require authentication for SELECT
CREATE POLICY "Authenticated users only"
ON public.suppliers FOR SELECT
TO authenticated
USING (true);

-- organizations: require authentication for SELECT
CREATE POLICY "Authenticated users only"
ON public.organizations FOR SELECT
TO authenticated
USING (true);

-- purchase_requisitions: require authentication for SELECT
CREATE POLICY "Authenticated users only"
ON public.purchase_requisitions FOR SELECT
TO authenticated
USING (true);
