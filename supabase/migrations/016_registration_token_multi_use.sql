-- =====================================================================
-- Migration: 016_registration_token_multi_use
-- Purpose  : Allow one registration token to be used by several users.
--            Admin sets `max_uses` when generating; each successful
--            registration increments `used_count`. The token becomes
--            'used' once used_count reaches max_uses.
--
-- Run once against the live database (migrations 001-015 already applied).
-- Idempotent: safe to re-run.
-- =====================================================================

BEGIN;

-- 1. New quota columns (existing rows behave exactly as before: single-use).
ALTER TABLE public.registration_tokens
  ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.registration_tokens
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;

-- 2. Backfill: tokens already marked 'used' count as one consumed slot.
UPDATE public.registration_tokens
   SET used_count = 1
 WHERE status = 'used' AND used_count = 0;

-- 3. Guard rails.
ALTER TABLE public.registration_tokens
  DROP CONSTRAINT IF EXISTS registration_tokens_max_uses_check;
ALTER TABLE public.registration_tokens
  ADD CONSTRAINT registration_tokens_max_uses_check CHECK (max_uses >= 1);

ALTER TABLE public.registration_tokens
  DROP CONSTRAINT IF EXISTS registration_tokens_used_count_check;
ALTER TABLE public.registration_tokens
  ADD CONSTRAINT registration_tokens_used_count_check CHECK (used_count >= 0);

-- 4. Atomic claim helper. A single UPDATE guarantees no double-spend even
--    when two registrations race for the last remaining slot.
CREATE OR REPLACE FUNCTION public.claim_registration_token(
  p_token   VARCHAR,
  p_user_id UUID,
  p_email   VARCHAR
)
RETURNS TABLE (
  id         UUID,
  used_count INTEGER,
  max_uses   INTEGER,
  status     VARCHAR
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.registration_tokens t
     SET used_count       = t.used_count + 1,
         used_by_user_web = p_user_id,
         used_by_email    = p_email,
         used_at          = NOW(),
         status           = CASE
                              WHEN t.used_count + 1 >= t.max_uses THEN 'used'
                              ELSE 'unused'
                            END
   WHERE t.token = p_token
     AND t.used_count < t.max_uses
  RETURNING t.id, t.used_count, t.max_uses, t.status;
$$;

COMMIT;

-- =====================================================================
-- Verification (run manually after applying):
--   SELECT token, status, used_count, max_uses FROM public.registration_tokens
--    ORDER BY created_at DESC LIMIT 10;
-- =====================================================================
