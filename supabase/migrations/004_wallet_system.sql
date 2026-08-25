-- ============================================
-- PBS Digital Store - Digital Wallet System Schema
-- Migration: 004_wallet_system
-- Description: Integrated user digital wallets, saldo topup, debit, & ledger transactions
-- ============================================

-- 1. USER WALLETS TABLE (1-to-1 dengan user_web)
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_web(id) ON DELETE CASCADE,
  saldo DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_wallets_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON public.user_wallets(user_id);

-- 2. WALLET TRANSACTIONS LEDGER
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_web(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup', 'debit', 'refund')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  ref_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_date ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON public.wallet_transactions(ref_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON public.wallet_transactions(type);

-- 3. SALDO TOPUP ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.saldo_topup_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topup_id TEXT NOT NULL UNIQUE, -- TOPUP-xxxxx
  user_id UUID NOT NULL REFERENCES public.user_web(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  gateway_fee DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'failed')),
  payment_method TEXT DEFAULT 'qris',
  midtrans_snap_token TEXT,
  midtrans_redirect_url TEXT,
  qr_code_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topup_orders_topup_id ON public.saldo_topup_orders(topup_id);
CREATE INDEX IF NOT EXISTS idx_topup_orders_user ON public.saldo_topup_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topup_orders_status ON public.saldo_topup_orders(status);

-- 4. FUNCTION: Auto-create wallet on user_web register
CREATE OR REPLACE FUNCTION public.trig_create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, saldo)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_user_wallet ON public.user_web;
CREATE TRIGGER trg_create_user_wallet
  AFTER INSERT ON public.user_web
  FOR EACH ROW
  EXECUTE FUNCTION public.trig_create_user_wallet();
