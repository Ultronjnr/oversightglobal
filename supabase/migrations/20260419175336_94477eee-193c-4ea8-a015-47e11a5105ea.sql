-- Create the subscription tier enum
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('FREEMIUM', 'STANDARD', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add tier column to profiles, default FREEMIUM for new users
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier public.subscription_tier NOT NULL DEFAULT 'FREEMIUM';

-- Backfill: all existing users default to STANDARD so we don't break them
UPDATE public.profiles
SET tier = 'STANDARD'
WHERE tier = 'FREEMIUM';