-- =====================================================================
-- Migration: 013_wallet_rpc
-- Purpose  : Atomic wallet operations for the user balance/deposit feature.
--            wallet_credit_user  -> add saldo (topup, admin adjust, refund)
--            wallet_debit_user   -> subtract saldo (pay with balance)
--            wallet_set_user     -> admin sets an absolute balance
--   Each writes a wallet_transactions ledger row with balance_after.
--
-- Idempotent (CREATE OR REPLACE). Run once against the live DB
-- (migrations 001-012 already applied; wallet tables exist from 004).
-- =====================================================================

BEGIN;

-- Ensure a wallet row exists, return it locked.
CREATE OR REPLACE FUNCTION public.wallet_ensure(p_user_id UUID)
RETURNS public.user_wallets AS $$
DECLARE
  w public.user_wallets;
BEGIN
  INSERT INTO public.user_wallets (user_id, saldo)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO w FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;
  RETURN w;
END;
$$ LANGUAGE plpgsql;

-- Credit (add) balance. type: topup | refund | adjust
CREATE OR REPLACE FUNCTION public.wallet_credit_user(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'topup',
  p_description TEXT DEFAULT NULL,
  p_ref_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  w public.user_wallets;
  v_new NUMERIC;
  v_type TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'msg', 'invalid_amount');
  END IF;

  -- Ledger CHECK only allows topup|debit|refund; map 'adjust' -> 'topup'.
  v_type := CASE WHEN p_type IN ('topup','debit','refund') THEN p_type ELSE 'topup' END;

  w := public.wallet_ensure(p_user_id);
  v_new := w.saldo + p_amount;

  UPDATE public.user_wallets SET saldo = v_new, updated_at = NOW() WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description, ref_id, status)
  VALUES (p_user_id, v_type, p_amount, v_new, p_description, p_ref_id, 'completed');

  RETURN json_build_object('ok', true, 'balance', v_new);
END;
$$ LANGUAGE plpgsql;

-- Debit (subtract) balance. Fails if insufficient.
CREATE OR REPLACE FUNCTION public.wallet_debit_user(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_ref_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  w public.user_wallets;
  v_new NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'msg', 'invalid_amount');
  END IF;

  w := public.wallet_ensure(p_user_id);

  IF w.saldo < p_amount THEN
    RETURN json_build_object('ok', false, 'msg', 'insufficient_balance', 'balance', w.saldo);
  END IF;

  v_new := w.saldo - p_amount;
  UPDATE public.user_wallets SET saldo = v_new, updated_at = NOW() WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description, ref_id, status)
  VALUES (p_user_id, 'debit', p_amount, v_new, p_description, p_ref_id, 'completed');

  RETURN json_build_object('ok', true, 'balance', v_new);
END;
$$ LANGUAGE plpgsql;

-- Admin: set an absolute balance and record the delta in the ledger.
CREATE OR REPLACE FUNCTION public.wallet_set_user(
  p_user_id UUID,
  p_new_balance NUMERIC,
  p_description TEXT DEFAULT 'admin_adjustment'
)
RETURNS JSON AS $$
DECLARE
  w public.user_wallets;
  v_delta NUMERIC;
BEGIN
  IF p_new_balance IS NULL OR p_new_balance < 0 THEN
    RETURN json_build_object('ok', false, 'msg', 'invalid_amount');
  END IF;

  w := public.wallet_ensure(p_user_id);
  v_delta := p_new_balance - w.saldo;

  UPDATE public.user_wallets SET saldo = p_new_balance, updated_at = NOW() WHERE user_id = p_user_id;

  IF v_delta <> 0 THEN
    INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description, ref_id, status)
    VALUES (
      p_user_id,
      CASE WHEN v_delta > 0 THEN 'topup' ELSE 'debit' END,
      ABS(v_delta),
      p_new_balance,
      COALESCE(p_description, 'admin_adjustment'),
      'ADMIN-ADJUST',
      'completed'
    );
  END IF;

  RETURN json_build_object('ok', true, 'balance', p_new_balance, 'delta', v_delta);
END;
$$ LANGUAGE plpgsql;

COMMIT;
