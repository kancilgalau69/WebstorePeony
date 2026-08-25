-- ============================================
-- PBS Digital Store - Affiliate System Schema
-- Migration: 003_affiliate_system
-- Description: User-level affiliate program for web store users
-- ============================================

-- 1. user_web_affiliates table (Profile affiliate per user_web)
CREATE TABLE IF NOT EXISTS public.user_web_affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_web_id UUID NOT NULL UNIQUE REFERENCES public.user_web(id) ON DELETE CASCADE,
  affiliate_code VARCHAR(20) NOT NULL UNIQUE,
  saldo DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_earnings DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_withdrawn DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_clicks INT NOT NULL DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_web_affiliates_code ON public.user_web_affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_user_web_affiliates_user ON public.user_web_affiliates(user_web_id);

-- 2. affiliate_clicks (tracking klik referral)
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.user_web_affiliates(id) ON DELETE CASCADE,
  affiliate_code VARCHAR(20) NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate ON public.affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created ON public.affiliate_clicks(created_at DESC);

-- 3. affiliate_earnings (record komisi per order)
CREATE TABLE IF NOT EXISTS public.affiliate_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.user_web_affiliates(id) ON DELETE CASCADE,
  affiliate_code VARCHAR(20) NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_code VARCHAR(50),
  order_amount DECIMAL(15,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, paid, reversed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_affiliate ON public.affiliate_earnings(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_status ON public.affiliate_earnings(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_created ON public.affiliate_earnings(created_at DESC);

-- 4. affiliate_withdrawals (penarikan saldo komisi affiliate)
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.user_web_affiliates(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, completed, rejected
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_affiliate ON public.affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON public.affiliate_withdrawals(status);

-- 5. Trigger auto-credit affiliate commission when order becomes completed
CREATE OR REPLACE FUNCTION process_order_affiliate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_affiliate_id UUID;
  v_affiliate_code VARCHAR(20);
  v_percent_str TEXT;
  v_percent DECIMAL(5,2);
  v_commission DECIMAL(15,2);
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    v_affiliate_code := NEW.affiliate_code;
    v_affiliate_id := NEW.affiliate_id;

    IF (v_affiliate_id IS NULL OR v_affiliate_code IS NULL) AND v_affiliate_code IS NOT NULL THEN
      SELECT id INTO v_affiliate_id FROM public.user_web_affiliates WHERE affiliate_code = v_affiliate_code AND is_active = true;
    END IF;

    IF v_affiliate_id IS NOT NULL THEN
      SELECT value INTO v_percent_str FROM public.settings WHERE key = 'affiliate_commission_percent';
      v_percent := COALESCE(NULLIF(v_percent_str, '')::DECIMAL, 5.00);

      v_commission := ROUND(NEW.total_amount * (v_percent / 100.00), 2);

      IF v_commission > 0 THEN
        INSERT INTO public.affiliate_earnings (
          affiliate_id, affiliate_code, order_id, order_code, order_amount, commission_percent, commission_amount, status
        ) VALUES (
          v_affiliate_id, v_affiliate_code, NEW.id, NEW.order_id, NEW.total_amount, v_percent, v_commission, 'approved'
        ) ON CONFLICT (order_id) DO NOTHING;

        UPDATE public.user_web_affiliates
        SET saldo = saldo + v_commission,
            total_earnings = total_earnings + v_commission,
            total_orders = total_orders + 1,
            updated_at = NOW()
        WHERE id = v_affiliate_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_affiliate_commission ON public.orders;
CREATE TRIGGER trg_orders_affiliate_commission
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION process_order_affiliate_commission();
