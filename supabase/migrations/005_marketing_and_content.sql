-- ============================================
-- PBS Digital Store - Marketing & Content Schema
-- Migration: 006_marketing_and_content
-- Description: Blog, Promos & Coupons, Announcement Popups, & Telegram Broadcasts
-- ============================================

-- ============================================
-- 1. BLOG SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON public.blog_categories(slug);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  featured_image TEXT,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  author_name VARCHAR(150) DEFAULT 'Admin',
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, published
  published_at TIMESTAMPTZ,
  view_count INT NOT NULL DEFAULT 0,
  meta_title VARCHAR(255),
  meta_description TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category_id);

CREATE OR REPLACE FUNCTION blog_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE OR REPLACE FUNCTION blog_set_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_published_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_published_at
  BEFORE INSERT OR UPDATE OF status ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_set_published_at();

INSERT INTO public.blog_categories (slug, name, description) VALUES
  ('umum', 'Umum', 'Informasi umum seputar produk digital'),
  ('tips-trik', 'Tips & Trik', 'Tips dan trik penggunaan produk'),
  ('promo', 'Promo', 'Informasi promo dan diskon')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. PROMO & COUPON SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.web_promos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  promo_type VARCHAR(30) NOT NULL DEFAULT 'percent', -- percent, fixed, buy_x_get_y, buy_x_get_x
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  max_discount DECIMAL(15,2),
  min_purchase DECIMAL(15,2) DEFAULT 0,
  required_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  required_qty INT DEFAULT 1,
  reward_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  reward_qty INT DEFAULT 1,
  eligible_for VARCHAR(30) NOT NULL DEFAULT 'registered_only', -- all, registered_only
  applicable_product_ids UUID[],
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  usage_limit INT,
  usage_per_user INT DEFAULT 1,
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_promos_code ON public.web_promos(code);
CREATE INDEX IF NOT EXISTS idx_web_promos_active ON public.web_promos(is_active);

CREATE TABLE IF NOT EXISTS public.web_promo_usages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_id UUID NOT NULL REFERENCES public.web_promos(id) ON DELETE CASCADE,
  promo_code VARCHAR(50) NOT NULL,
  user_web_id UUID REFERENCES public.user_web(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code VARCHAR(50),
  discount_applied DECIMAL(15,2) NOT NULL DEFAULT 0,
  reward_product_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_promo_usages_promo ON public.web_promo_usages(promo_id);
CREATE INDEX IF NOT EXISTS idx_web_promo_usages_user ON public.web_promo_usages(user_web_id);

CREATE OR REPLACE FUNCTION web_promos_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_web_promos_updated_at ON public.web_promos;
CREATE TRIGGER trg_web_promos_updated_at
  BEFORE UPDATE ON public.web_promos
  FOR EACH ROW EXECUTE FUNCTION web_promos_set_updated_at();

-- ============================================
-- 3. ANNOUNCEMENTS & POPUPS
-- ============================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(30) DEFAULT 'info', -- info, warning, success, danger
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcement_popups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  button_text VARCHAR(100),
  button_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. TELEGRAM BROADCAST SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  image_url TEXT,
  button_text VARCHAR(100),
  button_url TEXT,
  status VARCHAR(30) DEFAULT 'draft', -- draft, scheduled, sending, completed, failed
  scheduled_at TIMESTAMPTZ,
  total_targets INT DEFAULT 0,
  successful_sends INT DEFAULT 0,
  failed_sends INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.broadcast_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES public.users(user_id),
  status VARCHAR(20) NOT NULL, -- success, failed
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_logs_broadcast ON public.broadcast_logs(broadcast_id);
