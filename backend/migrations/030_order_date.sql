-- =============================================
-- 030: Add order_date to mp_costs_details
--
-- PROBLEM: mp_costs_details.date = settlement date (operation_date from Ozon API).
-- UE endpoint filters by this date, but user selects period by ORDER date.
-- Settlement period includes calculations for orders from DIFFERENT periods.
-- Result: Ozon UE deductions 1,982 RUB vs LK ~455 RUB (period 21-26 Feb).
--
-- SOLUTION: Store order_date from posting.order_date (Ozon finance API).
-- UE endpoint will filter by order_date for precise per-order-period matching.
-- costs-tree RPC stays settlement-based (correct for that use case).
--
-- Date: 2026-02-28
-- =============================================

-- 1. Add order_date column (nullable — WB and old data won't have it)
ALTER TABLE mp_costs_details ADD COLUMN IF NOT EXISTS order_date DATE;

-- 2. Index for fast UE queries filtering by order_date
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_order_date
    ON mp_costs_details(user_id, marketplace, order_date)
    WHERE order_date IS NOT NULL;

-- 3. Backfill: for existing Ozon rows, use settlement date as approximation
-- This is imprecise but better than NULL. Real order_date will be populated on next re-sync.
UPDATE mp_costs_details
SET order_date = date
WHERE order_date IS NULL
  AND marketplace = 'ozon';
