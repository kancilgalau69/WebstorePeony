-- =====================================================================
-- Migration: 014_drop_affiliate_system
-- Purpose  : Permanently remove the affiliate program from the database.
--            The customer web-store affiliate feature (dashboard pages,
--            API routes, user affiliate page, click/earning tracking)
--            has been retired, so its tables/functions/triggers/columns/
--            policies/settings are no longer needed.
--
-- SAFETY   : This is DESTRUCTIVE. It permanently deletes all affiliate
--            data (affiliate accounts, clicks, earnings, withdrawals) and
--            drops the affiliate_id / affiliate_code columns from orders.
--            Take a database backup before running in production.
--
-- Run once against the live database (migrations 001-013 already applied).
-- Idempotent: safe to run more than once (uses IF EXISTS).
-- =====================================================================

BEGIN;

-- 1. Drop the commission trigger + function on orders (created in 003).
DROP TRIGGER  IF EXISTS trg_orders_affiliate_commission ON public.orders;
DROP FUNCTION IF EXISTS public.process_order_affiliate_commission() CASCADE;

-- Drop the click-counter RPC if it exists (referenced by old code; may or
-- may not be present in the live DB).
DROP FUNCTION IF EXISTS public.increment_affiliate_clicks(uuid) CASCADE;

-- 2. Drop RLS policies (harmless if the table/policy is already gone).
DROP POLICY IF EXISTS "user_web_affiliates_all"    ON public.user_web_affiliates;
DROP POLICY IF EXISTS "affiliate_clicks_all"       ON public.affiliate_clicks;
DROP POLICY IF EXISTS "affiliate_earnings_all"     ON public.affiliate_earnings;
DROP POLICY IF EXISTS "affiliate_withdrawals_all"  ON public.affiliate_withdrawals;

-- 3. Drop tables. CASCADE removes dependent objects (indexes, FKs, child rows).
--    Order: children first, then parents (CASCADE also covers this).
DROP TABLE IF EXISTS public.affiliate_withdrawals  CASCADE;
DROP TABLE IF EXISTS public.affiliate_earnings     CASCADE;
DROP TABLE IF EXISTS public.affiliate_clicks       CASCADE;
DROP TABLE IF EXISTS public.user_web_affiliates    CASCADE;

-- 4. Drop affiliate tracking columns on orders (created in 001).
ALTER TABLE public.orders DROP COLUMN IF EXISTS affiliate_code;
ALTER TABLE public.orders DROP COLUMN IF EXISTS affiliate_id;

-- 5. Remove affiliate/referral-related settings rows (ignore if missing).
DELETE FROM public.settings
 WHERE key IN (
   'enable_referral',
   'affiliate_enabled',
   'affiliate_commission_percent',
   'affiliate_min_withdraw'
 );

COMMIT;

-- =====================================================================
-- Verification (run manually after applying):
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public' AND table_name LIKE '%affiliate%';
--   -- expected: 0 rows
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'orders'
--      AND column_name IN ('affiliate_id', 'affiliate_code');
--   -- expected: 0 rows
-- =====================================================================
