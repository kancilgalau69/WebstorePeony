-- ============================================
-- PBS Digital Store - Reseller System Schema
-- Migration: 002_reseller_system
-- Description: Reseller management (stores, pricing, orders, withdrawals, security tables)
-- ============================================

-- 1. Resellers Table (toko reseller)
CREATE TABLE IF NOT EXISTS public.resellers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_reseller VARCHAR(255),
  nama_toko VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  password_hash TEXT NOT NULL,
  logo_url TEXT,
  deskripsi TEXT,
  alamat TEXT,
  whatsapp VARCHAR(50),
  instagram VARCHAR(255),
  warna_tema VARCHAR(7) DEFAULT '#5c63f2',
  is_active BOOLEAN DEFAULT true,
  saldo DECIMAL(15,2) DEFAULT 0,
  total_penjualan DECIMAL(15,2) DEFAULT 0,
  total_komisi DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resellers_slug ON public.resellers(slug);
CREATE INDEX IF NOT EXISTS idx_resellers_email ON public.resellers(email);
CREATE INDEX IF NOT EXISTS idx_resellers_is_active ON public.resellers(is_active);

-- 2. Reseller Product Visibility
CREATE TABLE IF NOT EXISTS public.reseller_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reseller_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_products_reseller ON public.reseller_products(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_products_product ON public.reseller_products(product_id);

-- 3. Reseller Pricing (harga jual reseller per produk)
CREATE TABLE IF NOT EXISTS public.reseller_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  margin_type VARCHAR(20) DEFAULT 'fixed', -- 'fixed' atau 'percent'
  margin_value DECIMAL(15,2) DEFAULT 0,
  harga_jual DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reseller_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_prices_reseller ON public.reseller_prices(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_prices_product ON public.reseller_prices(product_id);

-- 4. Reseller Orders
CREATE TABLE IF NOT EXISTS public.reseller_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL UNIQUE, -- RS-xxxxx
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pending', -- pending, completed, cancelled, expired
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_modal DECIMAL(15,2) DEFAULT 0,
  komisi DECIMAL(15,2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_url TEXT,
  midtrans_token TEXT,
  transaction_id VARCHAR(255),
  items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_orders_reseller ON public.reseller_orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_order_id ON public.reseller_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_status ON public.reseller_orders(status);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_created ON public.reseller_orders(created_at DESC);

-- 5. Reseller Order Items
CREATE TABLE IF NOT EXISTS public.reseller_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.reseller_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_code VARCHAR(100),
  product_name VARCHAR(255),
  quantity INT DEFAULT 1,
  harga_modal DECIMAL(15,2) DEFAULT 0,
  harga_jual DECIMAL(15,2) DEFAULT 0,
  item_data TEXT,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_order_items_order ON public.reseller_order_items(order_id);

-- 6. Reseller Withdrawals
CREATE TABLE IF NOT EXISTS public.reseller_withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected, completed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_withdrawals_reseller ON public.reseller_withdrawals(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_withdrawals_status ON public.reseller_withdrawals(status);

-- 7. Reseller Security & Session Tables
CREATE TABLE IF NOT EXISTS public.web_reseller_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(100),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_reseller_sessions_token ON public.web_reseller_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_web_reseller_sessions_reseller ON public.web_reseller_sessions(reseller_id);

CREATE TABLE IF NOT EXISTS public.web_reseller_login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(100) NOT NULL,
  success BOOLEAN DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_reseller_login_attempts_email ON public.web_reseller_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_web_reseller_login_attempts_ip ON public.web_reseller_login_attempts(ip_address);

CREATE TABLE IF NOT EXISTS public.web_reseller_security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(100),
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_reseller_security_logs_reseller ON public.web_reseller_security_logs(reseller_id);
CREATE INDEX IF NOT EXISTS idx_web_reseller_security_logs_event ON public.web_reseller_security_logs(event_type);

CREATE TABLE IF NOT EXISTS public.web_reseller_blocked_ips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address VARCHAR(100) NOT NULL UNIQUE,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_web_reseller_blocked_ips_ip ON public.web_reseller_blocked_ips(ip_address);

-- 8. Public Registration Settings
INSERT INTO public.settings (key, value, description) VALUES
  ('reseller_registration_enabled', 'true', 'Enable public reseller registration page')
ON CONFLICT (key) DO NOTHING;
