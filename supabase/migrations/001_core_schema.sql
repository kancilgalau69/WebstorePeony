-- ============================================
-- PBS Digital Store - Core Database Schema
-- Migration: 001_core_schema
-- Description: Consolidated core schema (products, items, users, user_web, orders, settings, security logs)
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

INSERT INTO public.settings (key, value, description) VALUES
  ('store_name', 'Rain Store', 'Nama toko yang ditampilkan di bot dan web'),
  ('store_description', 'Toko Produk Digital Terpercaya #1', 'Deskripsi toko untuk pemasaran'),
  ('support_contact', '@aryadwinata543', 'Kontak dukungan pelanggan'),
  ('catalog_banner_url', 'https://imgcdn.dev/i/YaULTN', 'URL Banner katalog utama'),
  ('items_per_page', '10', 'Jumlah produk per halaman'),
  ('grid_cols', '5', 'Jumlah kolom grid produk'),
  ('enable_promo', 'true', 'Aktifkan fitur kode promo'),
  ('enable_referral', 'true', 'Aktifkan fitur sistem referral affiliate'),
  ('enable_analytics', 'true', 'Aktifkan analitik'),
  ('enable_favorites', 'true', 'Aktifkan fitur favorit'),
  ('payment_ttl_minutes', '15', 'Waktu tenggat pembayaran dalam menit'),
  ('currency', 'IDR', 'Kode mata uang'),
  ('locale', 'id-ID', 'Format bahasa/lokal')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- ============================================
-- 2. PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode VARCHAR(50) UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  kategori VARCHAR(100),
  harga DECIMAL(12,2) NOT NULL DEFAULT 0,
  harga_bot DECIMAL(12,2),
  harga_web DECIMAL(12,2),
  harga_lama DECIMAL(12,2),
  stok INTEGER NOT NULL DEFAULT 0,
  ikon TEXT,
  deskripsi TEXT,
  wa TEXT,
  alias TEXT[],
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_kode ON public.products(kode);
CREATE INDEX IF NOT EXISTS idx_products_kategori ON public.products(kategori);
CREATE INDEX IF NOT EXISTS idx_products_aktif ON public.products(aktif);
CREATE INDEX IF NOT EXISTS idx_products_stok ON public.products(stok);

CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING gin(
  to_tsvector('indonesian', coalesce(nama, '') || ' ' || coalesce(deskripsi, '') || ' ' || coalesce(kategori, ''))
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. PRODUCT DIGITAL ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.product_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_code VARCHAR(50) NOT NULL,
  item_data TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available, reserved, sold, invalid
  order_id VARCHAR(50),
  sold_to_user_id BIGINT,
  sold_at TIMESTAMPTZ,
  reserved_for_order VARCHAR(50),
  reserved_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,
  notes TEXT,
  batch VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON public.product_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_items_product_code ON public.product_items(product_code);
CREATE INDEX IF NOT EXISTS idx_product_items_status ON public.product_items(status);
CREATE INDEX IF NOT EXISTS idx_product_items_order_id ON public.product_items(order_id);
CREATE INDEX IF NOT EXISTS idx_product_items_reserved_for_order ON public.product_items(reserved_for_order);

-- Functions & Triggers for product_items
CREATE OR REPLACE FUNCTION get_available_items_count(p_product_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.product_items
    WHERE product_id = p_product_id
      AND status = 'available'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reserve_items_for_order(
  p_order_id VARCHAR(50),
  p_product_code VARCHAR(50),
  p_quantity INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_product_id UUID;
  v_available_count INTEGER;
  v_items_updated INTEGER;
BEGIN
  SELECT id INTO v_product_id
  FROM public.products
  WHERE kode = p_product_code AND aktif = true;
  
  IF v_product_id IS NULL THEN
    RETURN json_build_object('ok', false, 'msg', 'product_not_found');
  END IF;
  
  v_available_count := get_available_items_count(v_product_id);
  
  IF v_available_count < p_quantity THEN
    RETURN json_build_object('ok', false, 'msg', 'insufficient_items', 'available', v_available_count);
  END IF;
  
  UPDATE public.product_items
  SET status = 'reserved',
      reserved_for_order = p_order_id,
      reserved_at = NOW(),
      reservation_expires_at = NOW() + INTERVAL '15 minutes'
  WHERE id IN (
    SELECT id
    FROM public.product_items
    WHERE product_id = v_product_id
      AND status = 'available'
    LIMIT p_quantity
  );
  
  GET DIAGNOSTICS v_items_updated = ROW_COUNT;
  
  RETURN json_build_object('ok', true, 'msg', 'items_reserved', 'count', v_items_updated);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finalize_items_for_order(
  p_order_id VARCHAR(50),
  p_user_id BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_items_data JSON;
  v_items_count INTEGER;
BEGIN
  SELECT 
    json_agg(json_build_object(
      'id', id,
      'product_code', product_code,
      'item_data', item_data
    )),
    COUNT(*)
  INTO v_items_data, v_items_count
  FROM public.product_items
  WHERE reserved_for_order = p_order_id
    AND status = 'reserved';
  
  IF v_items_count = 0 THEN
    RETURN json_build_object('ok', false, 'msg', 'no_reserved_items');
  END IF;
  
  UPDATE public.product_items
  SET status = 'sold',
      order_id = p_order_id,
      sold_to_user_id = p_user_id,
      sold_at = NOW(),
      reserved_for_order = NULL
  WHERE reserved_for_order = p_order_id
    AND status = 'reserved';
  
  RETURN json_build_object(
    'ok', true, 
    'msg', 'items_finalized', 
    'count', v_items_count,
    'items', v_items_data
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_reserved_items(
  p_order_id VARCHAR(50)
)
RETURNS JSON AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.product_items
  SET status = 'available',
      reserved_for_order = NULL,
      reserved_at = NULL,
      reservation_expires_at = NULL
  WHERE reserved_for_order = p_order_id
    AND status = 'reserved';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN json_build_object('ok', true, 'msg', 'items_released', 'count', v_count);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION clean_expired_item_reservations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.product_items
  SET status = 'available',
      reserved_for_order = NULL,
      reserved_at = NULL,
      reservation_expires_at = NULL
  WHERE status = 'reserved'
    AND reservation_expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_target_product_id UUID;
BEGIN
  v_target_product_id := COALESCE(NEW.product_id, OLD.product_id);
  IF v_target_product_id IS NOT NULL THEN
    UPDATE public.products
    SET stok = (
      SELECT COUNT(*)
      FROM public.product_items
      WHERE product_id = v_target_product_id
        AND status = 'available'
    )
    WHERE id = v_target_product_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_items_sync_stock ON public.product_items;
CREATE TRIGGER product_items_sync_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.product_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_stock();

-- Inventory Summary View
CREATE OR REPLACE VIEW public.product_inventory_summary AS
SELECT 
  p.id as product_id,
  p.kode,
  p.nama,
  p.kategori,
  p.stok as stock_count,
  COUNT(pi.id) FILTER (WHERE pi.status = 'available') as available_items,
  COUNT(pi.id) FILTER (WHERE pi.status = 'reserved') as reserved_items,
  COUNT(pi.id) FILTER (WHERE pi.status = 'sold') as sold_items,
  COUNT(pi.id) FILTER (WHERE pi.status = 'invalid') as invalid_items,
  COUNT(pi.id) as total_items
FROM public.products p
LEFT JOIN public.product_items pi ON p.id = pi.product_id
GROUP BY p.id, p.kode, p.nama, p.kategori, p.stok;

-- ============================================
-- 4. USERS (TELEGRAM) & USER_WEB (WEB STORE)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(100),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  language VARCHAR(10) DEFAULT 'id',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON public.users(last_activity);

CREATE TABLE IF NOT EXISTS public.user_web (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_web_email ON public.user_web(email);
CREATE INDEX IF NOT EXISTS idx_user_web_phone ON public.user_web(phone);
CREATE INDEX IF NOT EXISTS idx_user_web_created_at ON public.user_web(created_at DESC);

-- ============================================
-- 5. ORDERS & ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(50) UNIQUE NOT NULL,
  user_id BIGINT REFERENCES public.users(user_id),
  user_web_id UUID REFERENCES public.user_web(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, completed, expired, cancelled
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50),
  payment_url TEXT,
  midtrans_token TEXT,
  transaction_id VARCHAR(255),
  user_ref VARCHAR(100),
  items JSONB,
  promo_code VARCHAR(50),
  promo_discount DECIMAL(15,2) DEFAULT 0,
  promo_reward_product TEXT,
  affiliate_code VARCHAR(20),
  affiliate_id UUID,
  delivery_email_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, sent, failed
  delivery_email_attempts INT DEFAULT 0,
  delivery_email_last_attempt_at TIMESTAMPTZ,
  delivery_email_sent_at TIMESTAMPTZ,
  delivery_email_last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_web_id ON public.orders(user_web_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_email_delivery ON public.orders(delivery_email_status, delivery_email_last_attempt_at);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_code VARCHAR(50) NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL,
  item_data TEXT,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- Stock Reservations
CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(50) NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_code VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  user_ref VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes',
  finalized_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON public.stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_id ON public.stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON public.stock_reservations(status);

CREATE TABLE IF NOT EXISTS public.favorites (
  user_id BIGINT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

-- ============================================
-- 6. ANALYTICS & SECURITY LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.analytics_product_views (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  view_count INTEGER DEFAULT 0,
  last_viewed TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  user_id BIGINT REFERENCES public.users(user_id),
  search_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_searched TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_daily_stats (
  date DATE PRIMARY KEY,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.abuse_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  ip VARCHAR(100),
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abuse_logs_type ON public.abuse_logs(type);
CREATE INDEX IF NOT EXISTS idx_abuse_logs_ip ON public.abuse_logs(ip);
CREATE INDEX IF NOT EXISTS idx_abuse_logs_created_at ON public.abuse_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.ip_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(150) NOT NULL UNIQUE,
  hits INT DEFAULT 1,
  first_hit_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_key ON public.ip_rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_expires ON public.ip_rate_limits(expires_at);

CREATE OR REPLACE FUNCTION clean_old_rate_limits_and_abuse_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.ip_rate_limits WHERE expires_at < NOW();
  DELETE FROM public.abuse_logs WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
