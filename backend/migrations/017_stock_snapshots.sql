-- Migration 017: Stock Snapshots — ежедневные снимки остатков
-- Позволяет строить графики динамики остатков по дням

CREATE TABLE IF NOT EXISTS mp_stock_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id UUID NOT NULL REFERENCES mp_products(id) ON DELETE CASCADE,
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT mp_stock_snapshots_user_product_mp_date_key
        UNIQUE (user_id, product_id, marketplace, date)
);

-- RLS
ALTER TABLE mp_stock_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stock snapshots"
    ON mp_stock_snapshots FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage stock snapshots"
    ON mp_stock_snapshots FOR ALL
    USING (true)
    WITH CHECK (true);

-- Index for efficient date-range queries
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_user_date
    ON mp_stock_snapshots (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_product_date
    ON mp_stock_snapshots (user_id, product_id, marketplace, date DESC);

COMMENT ON TABLE mp_stock_snapshots IS 'Daily stock quantity snapshots per product per marketplace. Populated after each stock sync.';
