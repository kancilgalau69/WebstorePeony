-- =====================================================================
-- Migration: 012_web_announcements
-- Purpose  : Announcement popup feature for the web store.
--            Dashboard (app/api/announcements) and the user store popup
--            (components/AnnouncementPopup) both use table `web_announcements`,
--            which did not exist yet (old schema had `announcements`).
--
-- Idempotent; safe to re-run. Run once against the live DB.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.web_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  image_url TEXT,
  button_label VARCHAR(100),
  button_url TEXT,
  category VARCHAR(20) NOT NULL DEFAULT 'info',            -- info | warning | error
  show_frequency VARCHAR(30) NOT NULL DEFAULT 'once_per_session', -- once_per_session | once_per_day | always
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_announcements_active ON public.web_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_web_announcements_sort ON public.web_announcements(sort_order);
CREATE INDEX IF NOT EXISTS idx_web_announcements_created ON public.web_announcements(created_at DESC);

-- keep updated_at fresh on update (uses existing helper if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_web_announcements_updated_at ON public.web_announcements;
    CREATE TRIGGER trg_web_announcements_updated_at
      BEFORE UPDATE ON public.web_announcements
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- RLS: enable + permissive policy (app-layer key separation, matching the schema)
ALTER TABLE public.web_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "web_announcements_all" ON public.web_announcements;
CREATE POLICY "web_announcements_all" ON public.web_announcements
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
