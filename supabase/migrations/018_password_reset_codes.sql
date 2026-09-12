-- =====================================================================
-- Migration: 018_password_reset_codes
-- Purpose  : Email verification codes for forgot-password and profile
--            change-password flows.
--
-- Idempotent; safe to re-run. Run once against the live DB.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_web_id UUID REFERENCES public.user_web(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  code_hash TEXT NOT NULL,
  purpose VARCHAR(30) NOT NULL DEFAULT 'forgot_password', -- forgot_password | change_password
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON public.password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user ON public.password_reset_codes(user_web_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires ON public.password_reset_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_purpose ON public.password_reset_codes(purpose);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "password_reset_codes_all" ON public.password_reset_codes;
CREATE POLICY "password_reset_codes_all" ON public.password_reset_codes
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
