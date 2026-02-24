-- Migration 023: Telegram bot integration
-- Tables: mp_telegram_links (user<->chat binding), mp_telegram_link_tokens (one-time deep link tokens)

-- ─── Main table: user <-> telegram chat binding ───
CREATE TABLE IF NOT EXISTS mp_telegram_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id BIGINT NOT NULL UNIQUE,
    telegram_username VARCHAR(100),
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{
        "daily_summary": true,
        "morning_time": "09:00",
        "evening_enabled": false,
        "evening_time": "21:00",
        "stock_alerts": true
    }'::jsonb,
    UNIQUE(user_id)
);

-- RLS
ALTER TABLE mp_telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram link"
    ON mp_telegram_links FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram link"
    ON mp_telegram_links FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram link"
    ON mp_telegram_links FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can do everything (bot operations)
CREATE POLICY "Service role full access telegram links"
    ON mp_telegram_links FOR ALL
    USING (auth.role() = 'service_role');

-- ─── One-time link tokens ───
CREATE TABLE IF NOT EXISTS mp_telegram_link_tokens (
    token UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
    used BOOLEAN DEFAULT FALSE
);

ALTER TABLE mp_telegram_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link tokens"
    ON mp_telegram_link_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access link tokens"
    ON mp_telegram_link_tokens FOR ALL
    USING (auth.role() = 'service_role');

-- Index for fast lookup by token
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires
    ON mp_telegram_link_tokens(token, used, expires_at);

-- Index for chat_id lookup (bot operations)
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id
    ON mp_telegram_links(telegram_chat_id);

-- Index for scheduled notifications query
CREATE INDEX IF NOT EXISTS idx_telegram_links_settings
    ON mp_telegram_links USING gin(settings);
