-- =====================================================================
-- Migration: 019_dedupe_order_items
-- Purpose  : Remove exact duplicate delivered items and prevent callback /
--            polling settlement races from inserting them again.
--
-- Idempotent; safe to re-run. Run once against the live DB.
-- =====================================================================

BEGIN;

-- Keep the oldest copy of every exact delivered item.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY order_id, product_code, item_data
      ORDER BY created_at ASC, id ASC
    ) AS row_num
  FROM public.order_items
  WHERE item_data IS NOT NULL
    AND BTRIM(item_data) <> ''
)
DELETE FROM public.order_items target
USING ranked
WHERE target.id = ranked.id
  AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_delivered_item
  ON public.order_items(order_id, product_code, item_data)
  WHERE item_data IS NOT NULL AND BTRIM(item_data) <> '';

COMMIT;

-- Verification:
-- SELECT order_id, product_code, item_data, COUNT(*)
-- FROM public.order_items
-- WHERE item_data IS NOT NULL AND BTRIM(item_data) <> ''
-- GROUP BY order_id, product_code, item_data
-- HAVING COUNT(*) > 1;
-- expected: 0 rows
