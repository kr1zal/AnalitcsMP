-- Migration 038: WB sale_dt — save buyout date + backfill delivery_date
--
-- Problem: sync_orders_wb didn't save sale_dt (buyout date) from reportDetailByPeriod.
-- WB settled orders had delivery_date = NULL, causing ghost orders in UE calculation.
--
-- Changes:
--   1. sync_service.py: parse sale_dt, save to delivery_date (code change)
--   2. dashboard.py: add .gt("price", 0) filter for WB UE (code change)
--   3. Backfill: set delivery_date = order_date for existing WB settled+sold orders
--      (approximate — new syncs will write exact sale_dt from reportDetail)
--
-- Safety: Does NOT touch Ozon orders.

-- Backfill: WB costs_details has posting_number = NULL (unlike Ozon),
-- so we use order_date as approximate delivery_date.
-- New syncs will overwrite with exact sale_dt.
UPDATE mp_orders
SET delivery_date = order_date
WHERE marketplace = 'wb'
  AND delivery_date IS NULL
  AND settled = true
  AND status = 'sold'
  AND price > 0;
