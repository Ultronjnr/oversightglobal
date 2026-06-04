-- 1. Remove existing duplicate unread notifications (keep most recent per user/type/record)
DELETE FROM public.notifications n
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, type, related_transaction_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.notifications
  WHERE is_read = false
    AND related_transaction_id IS NOT NULL
) d
WHERE n.id = d.id AND d.rn > 1;

-- 2. Partial unique index: one unread notification per (user, type, record)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_unread_idx
  ON public.notifications (user_id, type, related_transaction_id)
  WHERE is_read = false AND related_transaction_id IS NOT NULL;

-- 3. Upsert in the central notify helper
CREATE OR REPLACE FUNCTION public._notify_users(_user_ids uuid[], _org_id uuid, _type notification_type, _title text, _message text, _related text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF _related IS NULL THEN
    -- No record to dedupe against; insert as-is
    INSERT INTO public.notifications (user_id, organization_id, title, message, type, related_transaction_id)
    SELECT DISTINCT u, _org_id, _title, _message, _type, _related
    FROM unnest(_user_ids) u
    WHERE u IS NOT NULL;
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, organization_id, title, message, type, related_transaction_id)
  SELECT DISTINCT u, _org_id, _title, _message, _type, _related
  FROM unnest(_user_ids) u
  WHERE u IS NOT NULL
  ON CONFLICT (user_id, type, related_transaction_id) WHERE (is_read = false AND related_transaction_id IS NOT NULL)
  DO UPDATE SET title = EXCLUDED.title,
               message = EXCLUDED.message,
               created_at = now();
END $function$;