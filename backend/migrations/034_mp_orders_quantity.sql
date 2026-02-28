-- Migration 034: Add quantity column to mp_orders
-- Fixes DATA-001: delivered_count counts rows (+1) instead of actual quantity.
-- sync_orders_ozon already sends quantity in upsert payload — after this migration
-- the column will be populated automatically on next sync.
-- Default=1 is safe for existing data (>95% of orders are single-item).

ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
