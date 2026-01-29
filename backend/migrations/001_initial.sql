-- =============================================
-- Таблицы для аналитики маркетплейсов
-- Префикс mp_ (marketplace)
-- =============================================

-- Товары (мастер-данные)
CREATE TABLE IF NOT EXISTS mp_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(20) UNIQUE NOT NULL,  -- Штрихкод (ШК) - универсальный идентификатор
    name VARCHAR(255) NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,  -- Закупочная цена

    -- WB идентификаторы
    wb_nm_id BIGINT,
    wb_vendor_code VARCHAR(50),

    -- Ozon идентификаторы
    ozon_product_id BIGINT,
    ozon_offer_id VARCHAR(50),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Продажи (ежедневная агрегация)
CREATE TABLE IF NOT EXISTS mp_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,  -- 'wb' или 'ozon'
    date DATE NOT NULL,

    orders_count INTEGER DEFAULT 0,      -- Заказы
    sales_count INTEGER DEFAULT 0,       -- Выкупы (шт)
    returns_count INTEGER DEFAULT 0,     -- Возвраты

    revenue DECIMAL(12, 2) DEFAULT 0,    -- Выручка
    buyout_percent DECIMAL(5, 2),        -- Процент выкупа

    -- Добавления в корзину
    cart_adds INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(product_id, marketplace, date)
);

-- Остатки на складах
CREATE TABLE IF NOT EXISTS mp_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    warehouse VARCHAR(100),              -- Название склада

    quantity INTEGER DEFAULT 0,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(product_id, marketplace, warehouse)
);

-- Удержания маркетплейса (ежедневная агрегация)
CREATE TABLE IF NOT EXISTS mp_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,

    commission DECIMAL(10, 2) DEFAULT 0,      -- Комиссия
    logistics DECIMAL(10, 2) DEFAULT 0,       -- Логистика
    storage DECIMAL(10, 2) DEFAULT 0,         -- Хранение
    promotion DECIMAL(10, 2) DEFAULT 0,       -- Продвижение/реклама
    penalties DECIMAL(10, 2) DEFAULT 0,       -- Штрафы
    acquiring DECIMAL(10, 2) DEFAULT 0,       -- Эквайринг
    other_costs DECIMAL(10, 2) DEFAULT 0,     -- Прочие удержания

    total_costs DECIMAL(10, 2) GENERATED ALWAYS AS (
        commission + logistics + storage + promotion + penalties + acquiring + other_costs
    ) STORED,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(product_id, marketplace, date)
);

-- География продаж
CREATE TABLE IF NOT EXISTS mp_sales_geo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    region VARCHAR(100) NOT NULL,

    orders_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(product_id, marketplace, date, region)
);

-- Рекламные расходы
CREATE TABLE IF NOT EXISTS mp_ad_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    campaign_id VARCHAR(50),
    campaign_name VARCHAR(255),

    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost DECIMAL(10, 2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,

    ctr DECIMAL(5, 2),                   -- Click-through rate
    cpc DECIMAL(10, 2),                  -- Cost per click
    acos DECIMAL(5, 2),                  -- Advertising cost of sale

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(product_id, marketplace, date, campaign_id)
);

-- Лог синхронизации
CREATE TABLE IF NOT EXISTS mp_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketplace VARCHAR(20) NOT NULL,
    sync_type VARCHAR(50) NOT NULL,      -- 'products', 'sales', 'stocks', 'costs'
    status VARCHAR(20) NOT NULL,          -- 'success', 'error'
    records_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_mp_sales_date ON mp_sales(date);
CREATE INDEX IF NOT EXISTS idx_mp_sales_product_marketplace ON mp_sales(product_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_stocks_product ON mp_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_mp_costs_date ON mp_costs(date);
CREATE INDEX IF NOT EXISTS idx_mp_costs_product ON mp_costs(product_id);

-- Вставка начальных данных о товарах
INSERT INTO mp_products (barcode, name, purchase_price) VALUES
    ('4670157464824', 'Магний + В6 хелат 800 мг', 280),
    ('4670157464831', 'Магний цитрат 800 мг', 250),
    ('4670157464848', 'L-карнитин 720 мг', 360),
    ('4670157464770', 'Витамин D3 + К2 260 мг', 280),
    ('4670227414995', 'Тестобустер', 404)
ON CONFLICT (barcode) DO UPDATE SET
    name = EXCLUDED.name,
    purchase_price = EXCLUDED.purchase_price,
    updated_at = NOW();
