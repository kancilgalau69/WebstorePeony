-- ============================================
-- PBS Digital Store - Unified RLS Policies & Security
-- Migration: 007_rls_and_permissions
-- Description: Centralized Row Level Security (RLS) & service role access policies
-- ============================================

-- Enable RLS across all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_web_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldo_topup_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_promo_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

-- 1. Service Role & Permissive Policies
DROP POLICY IF EXISTS "service_role_all" ON public.settings;
CREATE POLICY "service_role_all" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_all" ON public.products;
CREATE POLICY "products_all" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "product_items_all" ON public.product_items;
CREATE POLICY "product_items_all" ON public.product_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users_all" ON public.users;
CREATE POLICY "users_all" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_web_all" ON public.user_web;
CREATE POLICY "user_web_all" ON public.user_web FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "orders_all" ON public.orders;
CREATE POLICY "orders_all" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_all" ON public.order_items;
CREATE POLICY "order_items_all" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stock_reservations_all" ON public.stock_reservations;
CREATE POLICY "stock_reservations_all" ON public.stock_reservations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "favorites_all" ON public.favorites;
CREATE POLICY "favorites_all" ON public.favorites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_web_affiliates_all" ON public.user_web_affiliates;
CREATE POLICY "user_web_affiliates_all" ON public.user_web_affiliates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "affiliate_clicks_all" ON public.affiliate_clicks;
CREATE POLICY "affiliate_clicks_all" ON public.affiliate_clicks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "affiliate_earnings_all" ON public.affiliate_earnings;
CREATE POLICY "affiliate_earnings_all" ON public.affiliate_earnings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "affiliate_withdrawals_all" ON public.affiliate_withdrawals;
CREATE POLICY "affiliate_withdrawals_all" ON public.affiliate_withdrawals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_wallets_all" ON public.user_wallets;
CREATE POLICY "user_wallets_all" ON public.user_wallets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wallet_transactions_all" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_all" ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "saldo_topup_orders_all" ON public.saldo_topup_orders;
CREATE POLICY "saldo_topup_orders_all" ON public.saldo_topup_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blog_categories_all" ON public.blog_categories;
CREATE POLICY "blog_categories_all" ON public.blog_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blog_posts_all" ON public.blog_posts;
CREATE POLICY "blog_posts_all" ON public.blog_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "web_promos_all" ON public.web_promos;
CREATE POLICY "web_promos_all" ON public.web_promos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "web_promo_usages_all" ON public.web_promo_usages;
CREATE POLICY "web_promo_usages_all" ON public.web_promo_usages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "announcements_all" ON public.announcements;
CREATE POLICY "announcements_all" ON public.announcements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "announcement_popups_all" ON public.announcement_popups;
CREATE POLICY "announcement_popups_all" ON public.announcement_popups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "broadcasts_all" ON public.broadcasts;
CREATE POLICY "broadcasts_all" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "broadcast_logs_all" ON public.broadcast_logs;
CREATE POLICY "broadcast_logs_all" ON public.broadcast_logs FOR ALL USING (true) WITH CHECK (true);
