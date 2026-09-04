-- =====================================================================
-- Migration: 017_user_profile_avatar
-- Purpose  : Allow web users to set a profile photo by URL.
--
-- Idempotent; safe to re-run. Run once against the live DB.
-- =====================================================================

BEGIN;

ALTER TABLE public.user_web
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMIT;
