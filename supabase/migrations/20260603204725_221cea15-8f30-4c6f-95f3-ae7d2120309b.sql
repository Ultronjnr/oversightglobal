ALTER TABLE public.supplier_invitations
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at timestamptz;