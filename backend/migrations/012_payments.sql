-- Migration 012: Payment integration (YooKassa)
-- НЕ ПРИМЕНЯТЬ АВТОМАТИЧЕСКИ — пользователь применит вручную в Supabase SQL Editor

-- ============================================================
-- 1. Таблица mp_payments — история всех платежей
-- ============================================================
CREATE TABLE IF NOT EXISTS mp_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    yookassa_payment_id TEXT NOT NULL UNIQUE,
    payment_method_id TEXT,       -- ID сохранённого метода оплаты (для рекуррентов)
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'RUB',
    status TEXT NOT NULL DEFAULT 'pending',  -- pending / succeeded / canceled
    plan TEXT NOT NULL,            -- pro / business
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE mp_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY mp_payments_user_select ON mp_payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY mp_payments_service_all ON mp_payments
    FOR ALL USING (true)
    WITH CHECK (true);
-- Примечание: service_role_key обходит RLS, но policy нужна для anon/authenticated

-- Индекс для быстрого поиска по yookassa_payment_id (webhook lookup)
CREATE INDEX IF NOT EXISTS idx_mp_payments_yookassa_id ON mp_payments(yookassa_payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_user_id ON mp_payments(user_id);

-- ============================================================
-- 2. Новые колонки в mp_user_subscriptions
-- ============================================================
ALTER TABLE mp_user_subscriptions
ADD COLUMN IF NOT EXISTS payment_method_id TEXT,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ============================================================
-- Готово. После применения этой миграции:
-- 1. Backend payment.py endpoints начнут работать
-- 2. Webhook от ЮКассы сможет сохранять платежи
-- 3. Подписки получат поля expires_at и auto_renew
-- ============================================================
