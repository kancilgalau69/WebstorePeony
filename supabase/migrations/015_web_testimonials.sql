-- =====================================================================
-- Migration: 015_web_testimonials
-- Purpose  : User-submitted testimonials for the web store.
--            New submissions are inactive until enabled by an admin.
--
-- Idempotent; safe to re-run. Run once against the live DB.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.web_testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_web_id UUID REFERENCES public.user_web(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  title VARCHAR(100) NOT NULL DEFAULT 'good',
  body TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_testimonials_active
  ON public.web_testimonials(is_active);
CREATE INDEX IF NOT EXISTS idx_web_testimonials_created
  ON public.web_testimonials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_testimonials_user
  ON public.web_testimonials(user_web_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_web_testimonials_updated_at ON public.web_testimonials;
    CREATE TRIGGER trg_web_testimonials_updated_at
      BEFORE UPDATE ON public.web_testimonials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

ALTER TABLE public.web_testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "web_testimonials_all" ON public.web_testimonials;
CREATE POLICY "web_testimonials_all" ON public.web_testimonials
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
