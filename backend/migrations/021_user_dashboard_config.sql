-- Widget Dashboard: user configuration for customizable metric cards
-- Stores enabled widgets, layout order, column count, and display preferences

CREATE TABLE IF NOT EXISTS user_dashboard_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Ordered list of enabled widget IDs (JSON array of strings)
    enabled_widgets JSONB NOT NULL DEFAULT '["orders_count","orders_revenue","revenue_settled","purchase_costs","net_profit","mp_deductions","ad_cost","payout","drr","profit_margin","period_delta"]'::jsonb,

    -- Grid layout positions for @dnd-kit persistence
    layout JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- User preferences
    column_count INTEGER NOT NULL DEFAULT 4 CHECK (column_count BETWEEN 1 AND 6),
    show_axis_badges BOOLEAN NOT NULL DEFAULT false,
    compact_mode BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_dashboard_config_user_unique UNIQUE (user_id)
);

-- RLS policies
ALTER TABLE user_dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dashboard config"
    ON user_dashboard_config FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard config"
    ON user_dashboard_config FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard config"
    ON user_dashboard_config FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard config"
    ON user_dashboard_config FOR DELETE
    USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_dashboard_config_user
    ON user_dashboard_config(user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_dashboard_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dashboard_config_updated
    BEFORE UPDATE ON user_dashboard_config
    FOR EACH ROW EXECUTE FUNCTION update_dashboard_config_timestamp();
