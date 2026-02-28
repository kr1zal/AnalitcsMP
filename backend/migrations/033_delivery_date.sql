-- =============================================
-- 033: Add delivery_date to mp_orders + last_delivery_sync_at to mp_sync_queue
--
-- PROBLEM: Our UE calculates by order_date (when ordered), but Ozon LK uses
-- delivery_date (when actually delivered to customer). Gap: shipped-but-not-delivered
-- orders create discrepancy in revenue, deductions, and COGS.
--
-- SOLUTION: Store delivery_date from Ozon Postings Report CSV.
-- UE endpoint will filter by delivery_date for precise delivered-order matching.
--
-- Date: 2026-02-28
-- =============================================

-- 1. Add delivery_date column to mp_orders (nullable — WB and old data won't have it)
ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMPTZ;

-- 2. Partial index for fast UE queries filtering by delivery_date
CREATE INDEX IF NOT EXISTS idx_mp_orders_delivery_date
    ON mp_orders(user_id, marketplace, delivery_date)
    WHERE delivery_date IS NOT NULL;

-- 3. Add last_delivery_sync_at to mp_sync_queue for 24h throttle
ALTER TABLE mp_sync_queue ADD COLUMN IF NOT EXISTS last_delivery_sync_at TIMESTAMPTZ;
