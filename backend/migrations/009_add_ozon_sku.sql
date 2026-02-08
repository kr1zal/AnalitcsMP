-- Migration 009: Add ozon_sku column to mp_products
-- Maps Ozon Analytics SKU ID to products (replaces hardcoded ozon_sku_map)
-- Run in Supabase SQL Editor

ALTER TABLE mp_products ADD COLUMN IF NOT EXISTS ozon_sku TEXT;

-- Seed existing data (from hardcoded map) so sync continues working immediately
UPDATE mp_products SET ozon_sku = '1659212207' WHERE barcode = '4670157464770' AND ozon_sku IS NULL;
UPDATE mp_products SET ozon_sku = '1659298299' WHERE barcode = '4670157464848' AND ozon_sku IS NULL;
UPDATE mp_products SET ozon_sku = '1691361926' WHERE barcode = '4670227414995' AND ozon_sku IS NULL;
UPDATE mp_products SET ozon_sku = '1658273141' WHERE barcode = '4670157464824' AND ozon_sku IS NULL;
UPDATE mp_products SET ozon_sku = '1658286198' WHERE barcode = '4670157464831' AND ozon_sku IS NULL;
