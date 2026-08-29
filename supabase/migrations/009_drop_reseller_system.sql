-- =====================================================================
-- Migration: 009_drop_reseller_system
-- Purpose  : Permanently remove the reseller subsystem from the database.
--            The reseller storefront (web-reseller) and reseller dashboard
--            services have been retired, so their tables/policies/settings
--            are no longer needed.
--
-- SAFETY   : This is DESTRUCTIVE. It permanently deletes all reseller data
--            (stores, prices, orders, withdrawals, sessions, security logs).
--            Take a database backup before running in production.
--
-- Run once against the live database (migrations 001-008 already applied).
-- Idempotent: safe to run more than once (uses IF EXISTS).
-- =====================================================================

BEGIN;

-- 1. Drop RLS policies (harmless if the table/policy is already gone).
DROP POLICY IF EXISTS "resellers_all"                    ON public.resellers;
DROP POLICY IF EXISTS "reseller_products_all"            ON public.reseller_products;
DROP POLICY IF EXISTS "reseller_prices_all"              ON public.reseller_prices;
DROP POLICY IF EXISTS "reseller_orders_all"              ON public.reseller_orders;
DROP POLICY IF EXISTS "reseller_order_items_all"         ON public.reseller_order_items;
DROP POLICY IF EXISTS "reseller_withdrawals_all"         ON public.reseller_withdrawals;
DROP POLICY IF EXISTS "web_reseller_sessions_all"        ON public.web_reseller_sessions;
DROP POLICY IF EXISTS "web_reseller_login_attempts_all"  ON public.web_reseller_login_attempts;
DROP POLICY IF EXISTS "web_reseller_security_logs_all"   ON public.web_reseller_security_logs;
DROP POLICY IF EXISTS "web_reseller_blocked_ips_all"     ON public.web_reseller_blocked_ips;

-- 2. Drop tables. CASCADE removes dependent objects (indexes, FKs, child rows).
--    Order: children first, then parents (CASCADE also covers this).
DROP TABLE IF EXISTS public.reseller_order_items        CASCADE;
DROP TABLE IF EXISTS public.reseller_orders             CASCADE;
DROP TABLE IF EXISTS public.reseller_prices             CASCADE;
DROP TABLE IF EXISTS public.reseller_products           CASCADE;
DROP TABLE IF EXISTS public.reseller_withdrawals        CASCADE;
DROP TABLE IF EXISTS public.web_reseller_sessions       CASCADE;
DROP TABLE IF EXISTS public.web_reseller_login_attempts CASCADE;
DROP TABLE IF EXISTS public.web_reseller_security_logs  CASCADE;
DROP TABLE IF EXISTS public.web_reseller_blocked_ips    CASCADE;
DROP TABLE IF EXISTS public.resellers                   CASCADE;

-- 3. Remove reseller-related settings rows (ignore if the settings table
--    or the specific keys don't exist).
DELETE FROM public.settings
 WHERE key IN ('reseller_registration_enabled');

COMMIT;

-- =====================================================================
-- Verification (run manually after applying):
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public' AND table_name LIKE '%reseller%';
--   -- expected: 0 rows
-- =====================================================================
