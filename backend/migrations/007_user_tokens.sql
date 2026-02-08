-- 007: Per-user API tokens for marketplace integrations
-- Одна строка на пользователя, все поля nullable (прогрессивное заполнение)
-- Значения зашифрованы Fernet на стороне backend

CREATE TABLE IF NOT EXISTS mp_user_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- WB (1 поле, encrypted)
    wb_api_token TEXT,

    -- Ozon Seller (2 поля, encrypted)
    ozon_client_id TEXT,
    ozon_api_key TEXT,

    -- Ozon Performance (2 поля, encrypted)
    ozon_perf_client_id TEXT,
    ozon_perf_secret TEXT,

    -- Метаданные
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Индекс
CREATE INDEX IF NOT EXISTS idx_mp_user_tokens_user ON mp_user_tokens(user_id);

-- RLS
ALTER TABLE mp_user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own tokens"
    ON mp_user_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
    ON mp_user_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
    ON mp_user_tokens FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
    ON mp_user_tokens FOR DELETE
    USING (auth.uid() = user_id);
