-- Migration 026: Data Enrichment — views in mp_sales + ad_revenue in mp_ad_costs
-- Phase 2: UE Polish + Data Enrichment
-- Date: 2026-02-26

-- 1. Add views column to mp_sales (session_view from Ozon Analytics API)
ALTER TABLE mp_sales ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- 2. Add ad_revenue column to mp_ad_costs (revenue from Ozon Performance CSV col[11])
ALTER TABLE mp_ad_costs ADD COLUMN IF NOT EXISTS ad_revenue NUMERIC(12,2) DEFAULT 0;

-- Index for views (useful for future conversion funnel: views -> cart -> order -> buyout)
CREATE INDEX IF NOT EXISTS idx_mp_sales_views ON mp_sales(user_id, date) WHERE views > 0;
