-- =====================================================================
-- Migration: 011_sync_product_item_codes
-- Purpose  : Keep product_items.product_code in sync with products.kode.
--
-- Root cause fixed: when a product's `kode` is changed in the dashboard,
-- existing product_items kept their OLD product_code. Delivery logic matches
-- finalized items to the order snapshot BY product_code, so a stale code made
-- items appear "not ready" (bug: "Data akun sedang disiapkan sistem...").
--
-- This migration:
--   1. Backfills any product_items whose product_code != its product's kode.
--   2. Adds a trigger so future kode changes cascade to product_items.
--
-- Idempotent; safe to re-run. Run once against the live DB.
-- =====================================================================

BEGIN;

-- 1. One-time backfill: align every item's product_code with its product's kode.
UPDATE public.product_items pi
SET product_code = p.kode
FROM public.products p
WHERE pi.product_id = p.id
  AND pi.product_code IS DISTINCT FROM p.kode;

-- 2. Trigger: when products.kode changes, update all its product_items.
CREATE OR REPLACE FUNCTION public.sync_product_item_codes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kode IS DISTINCT FROM OLD.kode THEN
    UPDATE public.product_items
    SET product_code = NEW.kode
    WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_sync_item_codes ON public.products;
CREATE TRIGGER trg_products_sync_item_codes
  AFTER UPDATE OF kode ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_item_codes();

COMMIT;

-- Verification (run manually):
--   SELECT pi.product_code, p.kode
--     FROM product_items pi JOIN products p ON p.id = pi.product_id
--    WHERE pi.product_code IS DISTINCT FROM p.kode;
--   -- expected: 0 rows
