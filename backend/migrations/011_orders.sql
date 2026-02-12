-- Migration 011: Per-order tracking table for Phase 2 Order Monitor
-- Stores individual orders/postings from WB (via srid) and Ozon (via posting_number)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS mp_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Идентификация
    marketplace VARCHAR(20) NOT NULL,           -- 'wb' | 'ozon'
    order_id VARCHAR(100) NOT NULL,             -- WB: srid, Ozon: posting_number
    product_id UUID REFERENCES mp_products(id),
    barcode VARCHAR(20),

    -- Даты
    order_date TIMESTAMPTZ NOT NULL,            -- WB: date, Ozon: in_process_at
    last_change_date TIMESTAMPTZ,               -- WB: lastChangeDate, Ozon: shipment_date

    -- Статус
    status VARCHAR(50) NOT NULL DEFAULT 'ordered',
    -- WB: 'ordered', 'sold', 'returned', 'cancelled'
    -- Ozon: 'ordered', 'delivering', 'sold', 'returned', 'cancelled'

    -- Финансовые данные
    price DECIMAL(12,2) DEFAULT 0,              -- Каталожная цена (WB: retail_price ДО скидки СПП)
    sale_price DECIMAL(12,2),                   -- Реальная цена продажи (WB: retail_price_withdisc_rub ПОСЛЕ СПП, Ozon: = price)
    sale_amount DECIMAL(12,2),                  -- WB: forPay из sales, Ozon: payout из financial_data
    commission DECIMAL(10,2) DEFAULT 0,         -- Комиссия МП
    logistics DECIMAL(10,2) DEFAULT 0,          -- Логистика
    storage_fee DECIMAL(10,2) DEFAULT 0,        -- Хранение (WB reportDetail)
    other_fees DECIMAL(10,2) DEFAULT 0,         -- Прочие удержания
    payout DECIMAL(12,2),                       -- К перечислению (ppvz_for_pay WB, payout Ozon)

    -- Статус финализации
    settled BOOLEAN NOT NULL DEFAULT FALSE,     -- TRUE = финотчёт МП подтвердил

    -- WB специфика
    wb_sale_id VARCHAR(50),                     -- WB: saleID (S*=sale, R*=return)
    wb_rrd_id BIGINT,                           -- WB: reportDetail rrd_id

    -- Ozon специфика
    ozon_posting_status VARCHAR(50),            -- Ozon: posting status as-is

    -- Дополнительно
    region VARCHAR(100),                        -- WB: regionName, Ozon: analytics_data.region
    warehouse VARCHAR(100),                     -- Склад отправления
    raw_data JSONB,                             -- Сырые данные API (опционально)

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_orders_unique UNIQUE (user_id, marketplace, order_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_mp_orders_user_id ON mp_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_date ON mp_orders(user_id, order_date);
CREATE INDEX IF NOT EXISTS idx_mp_orders_status ON mp_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mp_orders_product ON mp_orders(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_marketplace_date ON mp_orders(user_id, marketplace, order_date);
CREATE INDEX IF NOT EXISTS idx_mp_orders_settled ON mp_orders(user_id, settled);

-- RLS
ALTER TABLE mp_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own orders"
    ON mp_orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
    ON mp_orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
    ON mp_orders FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders"
    ON mp_orders FOR DELETE
    USING (auth.uid() = user_id);
