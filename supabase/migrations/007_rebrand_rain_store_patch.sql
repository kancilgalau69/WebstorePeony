-- ============================================
-- Rain Store - Rebranding Patch Migration
-- Migration: 007_rebrand_rain_store_patch
-- Description: Patch SQL to update existing database settings & configuration to Rain Store
-- ============================================

-- Update store_name in public.settings
UPDATE public.settings 
SET value = 'Rain Store', 
    updated_at = NOW() 
WHERE key = 'store_name';

-- Ensure store_name setting exists if missing
INSERT INTO public.settings (key, value, description) VALUES
  ('store_name', 'Rain Store', 'Nama toko yang ditampilkan di bot dan web')
ON CONFLICT (key) DO UPDATE SET value = 'Rain Store';

-- Update store_description in public.settings
UPDATE public.settings 
SET value = 'Toko Produk Digital Terpercaya #1', 
    updated_at = NOW() 
WHERE key = 'store_description';

-- Comments update
COMMENT ON TABLE public.products IS 'Rain Store - Catalog products with stock management';
COMMENT ON TABLE public.orders IS 'Rain Store - Customer orders with payment tracking';
COMMENT ON TABLE public.resellers IS 'Rain Store - Reseller store profiles';
