-- =====================================================================
-- Migration: 010_registration_tokens
-- Purpose  : Gate user registration behind admin-issued tokens.
--            Admin generates tokens in the dashboard; a new user must
--            enter a valid, unused token on the registration page.
--
-- Run once against the live database (migrations 001-009 already applied).
-- Idempotent: safe to re-run (IF NOT EXISTS / IF EXISTS).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.registration_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unused',   -- unused | used
  note TEXT,                                       -- optional label (e.g. buyer name)
  used_by_user_web UUID REFERENCES public.user_web(id) ON DELETE SET NULL,
  used_by_email VARCHAR(255),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_tokens_token  ON public.registration_tokens(token);
CREATE INDEX IF NOT EXISTS idx_registration_tokens_status ON public.registration_tokens(status);
CREATE INDEX IF NOT EXISTS idx_registration_tokens_created ON public.registration_tokens(created_at DESC);

-- RLS: enable + permissive policy (access is controlled at the app layer via
-- service-role key vs anon key, matching the rest of the schema).
ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registration_tokens_all" ON public.registration_tokens;
CREATE POLICY "registration_tokens_all" ON public.registration_tokens
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
