-- Migration 037: Composite indexes for multi-tenant scale
-- Phase 0.2 of scalability roadmap
--
-- Problem: existing indexes are (date, marketplace) WITHOUT user_id.
-- For multi-tenant SaaS, user_id must be the LEADING column.
-- Without this, Postgres does seq scan on user_id filter then index scan on date.
--
-- Without CONCURRENTLY — safe for Supabase Dashboard (tables are tiny now).
-- Brief table lock <1s at current data volume.
-- Safe to re-run (IF NOT EXISTS).

-- mp_sales: most queried table (UE, charts, stocks forecast, ads, plan)
-- Covers: .eq("user_id").gte("date").lte("date") with optional .eq("marketplace")
CREATE INDEX IF NOT EXISTS idx_mp_sales_user_mp_date
    ON mp_sales(user_id, marketplace, date);

-- mp_costs: UE deductions, costs-tree
CREATE INDEX IF NOT EXISTS idx_mp_costs_user_mp_date
    ON mp_costs(user_id, marketplace, date);

-- mp_costs_details: Ozon UE (order_date path + settlement date path)
-- Two indexes: one for date (settlement), one for order_date (UE)
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_user_mp_date
    ON mp_costs_details(user_id, marketplace, date);

CREATE INDEX IF NOT EXISTS idx_mp_costs_details_user_mp_order_date
    ON mp_costs_details(user_id, marketplace, order_date);

-- mp_ad_costs: ads page, UE ads, DRR
CREATE INDEX IF NOT EXISTS idx_mp_ad_costs_user_mp_date
    ON mp_ad_costs(user_id, marketplace, date);

-- mp_stock_snapshots: stock history chart
-- Already has (user_id, date) but needs marketplace for filtered queries
CREATE INDEX IF NOT EXISTS idx_mp_stock_snapshots_user_mp_date
    ON mp_stock_snapshots(user_id, marketplace, date);

-- mp_stocks: current stocks endpoint
CREATE INDEX IF NOT EXISTS idx_mp_stocks_user_mp
    ON mp_stocks(user_id, marketplace);
