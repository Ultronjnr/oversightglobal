
DROP POLICY IF EXISTS "authenticated_org_scoped_read" ON realtime.messages;
CREATE POLICY "authenticated_org_scoped_read"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE (public.get_user_organization(auth.uid())::text || ':%')
);

DROP POLICY IF EXISTS "authenticated_org_scoped_write" ON realtime.messages;
CREATE POLICY "authenticated_org_scoped_write"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() LIKE (public.get_user_organization(auth.uid())::text || ':%')
);
