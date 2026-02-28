-- Migration 031: Per-product storage costs from Ozon Placement Report API
-- Date: 2026-02-28
-- Purpose: Store per-product storage costs from /v1/report/placement/by-products/create
--          Replaces equal distribution of account-level storage in UE calculations

-- 1. New table
CREATE TABLE IF NOT EXISTS mp_storage_costs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    marketplace VARCHAR(10) NOT NULL DEFAULT 'ozon',
    product_id UUID NOT NULL REFERENCES mp_products(id),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    storage_cost NUMERIC(12,2) NOT NULL DEFAULT 0,    -- стоимость размещения за период (руб)
    quantity INTEGER DEFAULT 0,                        -- кол-во на складе (шт)
    volume_liters NUMERIC(10,2) DEFAULT 0,             -- объём (л)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, marketplace, product_id, date_from, date_to)
);

-- 2. RLS
ALTER TABLE mp_storage_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own storage costs" ON mp_storage_costs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access storage costs" ON mp_storage_costs
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_mp_storage_costs_lookup
    ON mp_storage_costs(user_id, marketplace, product_id, date_from, date_to);
