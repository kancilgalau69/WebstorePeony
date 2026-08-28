-- ============================================
-- PBS Digital Store - Payment Gateway Update
-- Migration: 008_payment_gateway_settings
-- ============================================

-- 1. Insert default active payment gateway setting
INSERT INTO public.settings (key, value, description)
VALUES ('active_payment_gateway', 'midtrans', 'Payment gateway aktif (midtrans/tokopay)')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

-- 2. Add payment_provider column to orders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'orders' 
          AND column_name = 'payment_provider'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN payment_provider VARCHAR(50) DEFAULT 'midtrans';
    END IF;
END $$;
