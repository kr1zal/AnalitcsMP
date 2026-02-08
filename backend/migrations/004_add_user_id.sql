-- =============================================
-- 004: Добавить user_id во все mp_* таблицы
-- Для SaaS multi-tenant изоляции данных
-- Выполнить в Supabase SQL Editor или через CLI
-- =============================================

-- Шаг 1: Добавить user_id колонку (NULLABLE пока — существующие данные без user_id)
ALTER TABLE mp_products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mp_sales ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mp_stocks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mp_costs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mp_costs_details ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mp_sales_geo ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mp_ad_costs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mp_sync_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Шаг 2: Индексы на user_id для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_mp_products_user ON mp_products(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_sales_user ON mp_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_stocks_user ON mp_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_costs_user ON mp_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_user ON mp_costs_details(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_sales_geo_user ON mp_sales_geo(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_ad_costs_user ON mp_ad_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_sync_log_user ON mp_sync_log(user_id);

-- Шаг 3: Пересоздать UNIQUE constraints с включением user_id
-- Это позволяет разным пользователям иметь одинаковые товары/данные

-- mp_products: barcode → (user_id, barcode)
ALTER TABLE mp_products DROP CONSTRAINT IF EXISTS mp_products_barcode_key;
ALTER TABLE mp_products ADD CONSTRAINT mp_products_user_barcode_key UNIQUE (user_id, barcode);

-- mp_sales: (product_id, marketplace, date) → (user_id, product_id, marketplace, date)
ALTER TABLE mp_sales DROP CONSTRAINT IF EXISTS mp_sales_product_id_marketplace_date_key;
ALTER TABLE mp_sales ADD CONSTRAINT mp_sales_user_product_mp_date_key UNIQUE (user_id, product_id, marketplace, date);

-- mp_stocks: (product_id, marketplace, warehouse) → (user_id, product_id, marketplace, warehouse)
ALTER TABLE mp_stocks DROP CONSTRAINT IF EXISTS mp_stocks_product_id_marketplace_warehouse_key;
ALTER TABLE mp_stocks ADD CONSTRAINT mp_stocks_user_product_mp_wh_key UNIQUE (user_id, product_id, marketplace, warehouse);

-- mp_costs: (product_id, marketplace, date) → (user_id, product_id, marketplace, date)
ALTER TABLE mp_costs DROP CONSTRAINT IF EXISTS mp_costs_product_id_marketplace_date_key;
ALTER TABLE mp_costs ADD CONSTRAINT mp_costs_user_product_mp_date_key UNIQUE (user_id, product_id, marketplace, date);

-- mp_sales_geo: (product_id, marketplace, date, region) → (user_id, ...)
ALTER TABLE mp_sales_geo DROP CONSTRAINT IF EXISTS mp_sales_geo_product_id_marketplace_date_region_key;
ALTER TABLE mp_sales_geo ADD CONSTRAINT mp_sales_geo_user_key UNIQUE (user_id, product_id, marketplace, date, region);

-- mp_ad_costs: (product_id, marketplace, date, campaign_id) → (user_id, ...)
ALTER TABLE mp_ad_costs DROP CONSTRAINT IF EXISTS mp_ad_costs_product_id_marketplace_date_campaign_id_key;
ALTER TABLE mp_ad_costs ADD CONSTRAINT mp_ad_costs_user_key UNIQUE (user_id, product_id, marketplace, date, campaign_id);

-- mp_costs_details и mp_sync_log — без UNIQUE constraints (оставляем как есть, только user_id добавлен)
