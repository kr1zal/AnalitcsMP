-- =============================================
-- ПОЛНАЯ СХЕМА ДЛЯ НОВОГО ПРОЕКТА SUPABASE (reviomp)
-- Объединяет миграции 001-012 + RPC функции
-- Выполнить ОДНИМ запросом в SQL Editor нового проекта
--
-- ВАЖНО: Этот скрипт создаёт ВСЕ таблицы с нуля.
-- После выполнения нужно:
-- 1. Зарегистрировать admin-аккаунт (exklante@gmail.com)
-- 2. Выполнить SEED_DATA.sql с новым admin UUID
-- =============================================

-- =============================================
-- ЧАСТЬ 1: ТАБЛИЦЫ
-- =============================================

-- 1. Товары (мастер-данные)
CREATE TABLE IF NOT EXISTS mp_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    barcode VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,

    -- WB идентификаторы
    wb_nm_id BIGINT,
    wb_vendor_code VARCHAR(50),

    -- Ozon идентификаторы
    ozon_product_id BIGINT,
    ozon_offer_id VARCHAR(50),
    ozon_sku TEXT,

    -- Product management (migration 013)
    sort_order INTEGER DEFAULT 0,
    product_group_id UUID DEFAULT NULL,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_products_user_barcode_key UNIQUE (user_id, barcode)
);

-- 2. Продажи (ежедневная агрегация)
CREATE TABLE IF NOT EXISTS mp_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,

    orders_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    returns_count INTEGER DEFAULT 0,

    revenue DECIMAL(12, 2) DEFAULT 0,
    buyout_percent DECIMAL(5, 2),
    cart_adds INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_sales_user_product_mp_date_key UNIQUE (user_id, product_id, marketplace, date)
);

-- 3. Остатки на складах
CREATE TABLE IF NOT EXISTS mp_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    warehouse VARCHAR(100),

    quantity INTEGER DEFAULT 0,

    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_stocks_user_product_mp_wh_key UNIQUE (user_id, product_id, marketplace, warehouse)
);

-- 4. Удержания маркетплейса (ежедневная агрегация)
CREATE TABLE IF NOT EXISTS mp_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,

    commission DECIMAL(10, 2) DEFAULT 0,
    logistics DECIMAL(10, 2) DEFAULT 0,
    storage DECIMAL(10, 2) DEFAULT 0,
    promotion DECIMAL(10, 2) DEFAULT 0,
    penalties DECIMAL(10, 2) DEFAULT 0,
    acquiring DECIMAL(10, 2) DEFAULT 0,
    other_costs DECIMAL(10, 2) DEFAULT 0,

    total_costs DECIMAL(10, 2) GENERATED ALWAYS AS (
        commission + logistics + storage + promotion + penalties + acquiring + other_costs
    ) STORED,

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_costs_user_product_mp_date_key UNIQUE (user_id, product_id, marketplace, date)
);

-- 5. Детализация удержаний (costs-tree)
CREATE TABLE IF NOT EXISTS mp_costs_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,

    category TEXT NOT NULL,
    subcategory TEXT,
    amount DECIMAL(12, 2) DEFAULT 0,
    operation_type TEXT,
    operation_id TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. География продаж
CREATE TABLE IF NOT EXISTS mp_sales_geo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    region VARCHAR(100) NOT NULL,

    orders_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_sales_geo_user_key UNIQUE (user_id, product_id, marketplace, date, region)
);

-- 7. Рекламные расходы
CREATE TABLE IF NOT EXISTS mp_ad_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id UUID REFERENCES mp_products(id),
    marketplace VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    campaign_id VARCHAR(50),
    campaign_name VARCHAR(255),

    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost DECIMAL(10, 2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,

    ctr DECIMAL(5, 2),
    cpc DECIMAL(10, 2),
    acos DECIMAL(5, 2),

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_ad_costs_user_key UNIQUE (user_id, product_id, marketplace, date, campaign_id)
);

-- 8. Лог синхронизации
CREATE TABLE IF NOT EXISTS mp_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    marketplace VARCHAR(20) NOT NULL,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_count INTEGER DEFAULT 0,
    error_message TEXT,
    trigger TEXT DEFAULT 'manual',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_sync_log_trigger_check CHECK (trigger IN ('auto', 'manual', 'admin', 'system'))
);

-- 9. Пользовательские API-токены (Fernet encrypted)
CREATE TABLE IF NOT EXISTS mp_user_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    wb_api_token TEXT,
    ozon_client_id TEXT,
    ozon_api_key TEXT,
    ozon_perf_client_id TEXT,
    ozon_perf_secret TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Подписки пользователей
CREATE TABLE IF NOT EXISTS mp_user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),

    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    changed_by TEXT,

    -- Payment (Phase 5 / migration 012)
    payment_method_id TEXT,
    auto_renew BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Очередь синхронизации
CREATE TABLE IF NOT EXISTS mp_sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    next_sync_at TIMESTAMPTZ NOT NULL,
    priority INTEGER NOT NULL DEFAULT 2,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,

    manual_syncs_today INTEGER NOT NULL DEFAULT 0,
    manual_syncs_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Moscow')::date,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_sync_queue_user_unique UNIQUE (user_id)
);

-- 12. Позаказная детализация
CREATE TABLE IF NOT EXISTS mp_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    marketplace VARCHAR(20) NOT NULL,
    order_id VARCHAR(100) NOT NULL,
    product_id UUID REFERENCES mp_products(id),
    barcode VARCHAR(20),

    order_date TIMESTAMPTZ NOT NULL,
    last_change_date TIMESTAMPTZ,

    status VARCHAR(50) NOT NULL DEFAULT 'ordered',

    price DECIMAL(12,2) DEFAULT 0,
    sale_price DECIMAL(12,2),
    sale_amount DECIMAL(12,2),
    commission DECIMAL(10,2) DEFAULT 0,
    logistics DECIMAL(10,2) DEFAULT 0,
    storage_fee DECIMAL(10,2) DEFAULT 0,
    other_fees DECIMAL(10,2) DEFAULT 0,
    payout DECIMAL(12,2),

    settled BOOLEAN NOT NULL DEFAULT FALSE,

    wb_sale_id VARCHAR(50),
    wb_rrd_id BIGINT,
    ozon_posting_status VARCHAR(50),

    region VARCHAR(100),
    warehouse VARCHAR(100),
    raw_data JSONB,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_orders_unique UNIQUE (user_id, marketplace, order_id)
);

-- 13. Платежи (YooKassa)
CREATE TABLE IF NOT EXISTS mp_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    yookassa_payment_id TEXT NOT NULL UNIQUE,
    payment_method_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'RUB',
    status TEXT NOT NULL DEFAULT 'pending',
    plan TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ЧАСТЬ 2: ИНДЕКСЫ
-- =============================================

-- mp_products
CREATE INDEX IF NOT EXISTS idx_mp_products_user ON mp_products(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_products_group ON mp_products(product_group_id) WHERE product_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mp_products_sort ON mp_products(user_id, sort_order);

-- mp_sales
CREATE INDEX IF NOT EXISTS idx_mp_sales_date ON mp_sales(date);
CREATE INDEX IF NOT EXISTS idx_mp_sales_product_marketplace ON mp_sales(product_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_sales_user ON mp_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_sales_date_mp ON mp_sales(date, marketplace);

-- mp_stocks
CREATE INDEX IF NOT EXISTS idx_mp_stocks_product ON mp_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_mp_stocks_user ON mp_stocks(user_id);

-- mp_costs
CREATE INDEX IF NOT EXISTS idx_mp_costs_date ON mp_costs(date);
CREATE INDEX IF NOT EXISTS idx_mp_costs_product ON mp_costs(product_id);
CREATE INDEX IF NOT EXISTS idx_mp_costs_user ON mp_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_costs_date_mp ON mp_costs(date, marketplace);

-- mp_costs_details
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_user ON mp_costs_details(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_date_mp ON mp_costs_details(date, marketplace);

-- mp_sales_geo
CREATE INDEX IF NOT EXISTS idx_mp_sales_geo_user ON mp_sales_geo(user_id);

-- mp_ad_costs
CREATE INDEX IF NOT EXISTS idx_mp_ad_costs_user ON mp_ad_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_ad_costs_date_mp ON mp_ad_costs(date, marketplace);

-- mp_sync_log
CREATE INDEX IF NOT EXISTS idx_mp_sync_log_user ON mp_sync_log(user_id);

-- mp_user_tokens
CREATE INDEX IF NOT EXISTS idx_mp_user_tokens_user ON mp_user_tokens(user_id);

-- mp_user_subscriptions
CREATE INDEX IF NOT EXISTS idx_mp_user_subscriptions_user ON mp_user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_user_subscriptions_plan ON mp_user_subscriptions(plan);

-- mp_sync_queue
CREATE INDEX IF NOT EXISTS idx_mp_sync_queue_schedule ON mp_sync_queue(priority, next_sync_at);
CREATE INDEX IF NOT EXISTS idx_mp_sync_queue_status ON mp_sync_queue(status);

-- mp_orders
CREATE INDEX IF NOT EXISTS idx_mp_orders_user_id ON mp_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_date ON mp_orders(user_id, order_date);
CREATE INDEX IF NOT EXISTS idx_mp_orders_status ON mp_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mp_orders_product ON mp_orders(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_marketplace_date ON mp_orders(user_id, marketplace, order_date);
CREATE INDEX IF NOT EXISTS idx_mp_orders_settled ON mp_orders(user_id, settled);

-- mp_payments
CREATE INDEX IF NOT EXISTS idx_mp_payments_yookassa_id ON mp_payments(yookassa_payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_user_id ON mp_payments(user_id);

-- =============================================
-- ЧАСТЬ 3: RLS (Row Level Security)
-- =============================================

-- Включаем RLS на всех таблицах
ALTER TABLE mp_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_costs_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_sales_geo ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_ad_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_payments ENABLE ROW LEVEL SECURITY;

-- mp_products
CREATE POLICY "Users see own products" ON mp_products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON mp_products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON mp_products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON mp_products FOR DELETE USING (auth.uid() = user_id);

-- mp_sales
CREATE POLICY "Users see own sales" ON mp_sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sales" ON mp_sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sales" ON mp_sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sales" ON mp_sales FOR DELETE USING (auth.uid() = user_id);

-- mp_stocks
CREATE POLICY "Users see own stocks" ON mp_stocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own stocks" ON mp_stocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own stocks" ON mp_stocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own stocks" ON mp_stocks FOR DELETE USING (auth.uid() = user_id);

-- mp_costs
CREATE POLICY "Users see own costs" ON mp_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own costs" ON mp_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own costs" ON mp_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own costs" ON mp_costs FOR DELETE USING (auth.uid() = user_id);

-- mp_costs_details
CREATE POLICY "Users see own costs_details" ON mp_costs_details FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own costs_details" ON mp_costs_details FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own costs_details" ON mp_costs_details FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own costs_details" ON mp_costs_details FOR DELETE USING (auth.uid() = user_id);

-- mp_sales_geo
CREATE POLICY "Users see own sales_geo" ON mp_sales_geo FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sales_geo" ON mp_sales_geo FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sales_geo" ON mp_sales_geo FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sales_geo" ON mp_sales_geo FOR DELETE USING (auth.uid() = user_id);

-- mp_ad_costs
CREATE POLICY "Users see own ad_costs" ON mp_ad_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ad_costs" ON mp_ad_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ad_costs" ON mp_ad_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ad_costs" ON mp_ad_costs FOR DELETE USING (auth.uid() = user_id);

-- mp_sync_log
CREATE POLICY "Users see own sync_log" ON mp_sync_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sync_log" ON mp_sync_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sync_log" ON mp_sync_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sync_log" ON mp_sync_log FOR DELETE USING (auth.uid() = user_id);

-- mp_user_tokens
CREATE POLICY "Users can select own tokens" ON mp_user_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tokens" ON mp_user_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON mp_user_tokens FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON mp_user_tokens FOR DELETE USING (auth.uid() = user_id);

-- mp_user_subscriptions (только SELECT для обычных пользователей)
CREATE POLICY "Users can select own subscription" ON mp_user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- mp_sync_queue (только SELECT для обычных пользователей)
CREATE POLICY "Users can select own sync_queue" ON mp_sync_queue FOR SELECT USING (auth.uid() = user_id);

-- mp_orders
CREATE POLICY "Users can select own orders" ON mp_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON mp_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON mp_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own orders" ON mp_orders FOR DELETE USING (auth.uid() = user_id);

-- mp_payments (SELECT для пользователей + полный доступ для service_role)
CREATE POLICY mp_payments_user_select ON mp_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY mp_payments_service_all ON mp_payments FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- ЧАСТЬ 4: RPC ФУНКЦИИ (финальные версии с p_user_id)
-- =============================================

-- 4.1 get_dashboard_summary
CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_orders INT;
  v_sales INT;
  v_returns INT;
  v_revenue NUMERIC;
  v_total_costs NUMERIC;
  v_ad_cost NUMERIC;
  v_purchase_costs_total NUMERIC;
  v_buyout_percent NUMERIC;
  v_avg_check NUMERIC;
  v_net_profit NUMERIC;
  v_drr NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(orders_count), 0),
    COALESCE(SUM(sales_count), 0),
    COALESCE(SUM(returns_count), 0),
    COALESCE(SUM(revenue), 0)
  INTO v_orders, v_sales, v_returns, v_revenue
  FROM mp_sales
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  SELECT COALESCE(SUM(total_costs), 0)
  INTO v_total_costs
  FROM mp_costs
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  SELECT COALESCE(SUM(cost), 0)
  INTO v_ad_cost
  FROM mp_ad_costs
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  SELECT COALESCE(SUM(p.purchase_price * s.sales_count), 0)
  INTO v_purchase_costs_total
  FROM mp_sales s
  JOIN mp_products p ON s.product_id = p.id
  WHERE s.date >= p_date_from::DATE
    AND s.date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR s.marketplace = p_marketplace)
    AND (p_user_id IS NULL OR s.user_id = p_user_id);

  v_buyout_percent := CASE WHEN v_orders > 0 THEN ROUND((v_sales::NUMERIC / v_orders) * 100, 1) ELSE 0 END;
  v_avg_check := CASE WHEN v_sales > 0 THEN ROUND(v_revenue / v_sales, 2) ELSE 0 END;
  v_net_profit := v_revenue - v_total_costs - v_purchase_costs_total - v_ad_cost;
  v_drr := CASE WHEN v_revenue > 0 THEN ROUND((v_ad_cost / v_revenue) * 100, 1) ELSE 0 END;

  RETURN json_build_object(
    'status', 'success',
    'period', json_build_object('from', p_date_from, 'to', p_date_to),
    'marketplace', COALESCE(p_marketplace, 'all'),
    'summary', json_build_object(
      'orders', v_orders,
      'sales', v_sales,
      'returns', v_returns,
      'revenue', v_revenue,
      'buyout_percent', v_buyout_percent,
      'net_profit', v_net_profit,
      'drr', v_drr,
      'ad_cost', v_ad_cost,
      'purchase_costs_total', v_purchase_costs_total,
      'total_costs', v_total_costs,
      'avg_check', v_avg_check,
      'costs_breakdown', json_build_object(
        'commission', 0, 'logistics', 0, 'storage', 0,
        'penalties', 0, 'acquiring', 0, 'other', 0
      )
    ),
    'previous_period', json_build_object(
      'revenue', 0, 'sales', 0, 'orders', 0, 'revenue_change_percent', 0
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.2 get_costs_tree
CREATE OR REPLACE FUNCTION get_costs_tree(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_include_children BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_tree JSON;
  v_total_accrued NUMERIC;
  v_total_revenue NUMERIC;
  v_percent_base_sales NUMERIC;
  v_source TEXT;
  v_has_details BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM mp_costs_details
    WHERE date >= p_date_from::DATE
      AND date <= p_date_to::DATE
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id)
    LIMIT 1
  ) INTO v_has_details;

  IF v_has_details THEN
    v_source := 'mp_costs_details';

    WITH categories AS (
      SELECT
        category,
        SUM(amount) as total_amount,
        json_agg(
          json_build_object('name', subcategory, 'amount', amount)
        ) FILTER (WHERE p_include_children AND subcategory IS NOT NULL AND subcategory != category) as children
      FROM (
        SELECT category, subcategory, SUM(amount) as amount
        FROM mp_costs_details
        WHERE date >= p_date_from::DATE
          AND date <= p_date_to::DATE
          AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
          AND (p_product_id IS NULL OR product_id = p_product_id)
          AND (p_user_id IS NULL OR user_id = p_user_id)
        GROUP BY category, subcategory
      ) sub
      GROUP BY category
    )
    SELECT json_agg(
      json_build_object(
        'name', category, 'amount', total_amount, 'percent', NULL,
        'children', COALESCE(children, '[]'::json)
      )
      ORDER BY
        CASE category
          WHEN 'Продажи' THEN 1
          WHEN 'Вознаграждение Ozon' THEN 2
          WHEN 'Вознаграждение Вайлдберриз (ВВ)' THEN 2
          WHEN 'Услуги доставки' THEN 3
          WHEN 'Услуги по доставке товара покупателю' THEN 3
          WHEN 'Услуги агентов' THEN 4
          WHEN 'Услуги FBO' THEN 5
          WHEN 'Стоимость хранения' THEN 5
          WHEN 'Продвижение и реклама' THEN 6
          WHEN 'Эквайринг/Комиссии за организацию платежей' THEN 7
          ELSE 10
        END
    ) INTO v_tree FROM categories;

    SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_percent_base_sales
    FROM mp_costs_details
    WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
      AND category = 'Продажи'
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id);

    SELECT COALESCE(SUM(amount), 0) INTO v_total_accrued
    FROM mp_costs_details
    WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id);

    v_total_revenue := v_percent_base_sales;

  ELSE
    v_source := 'fallback_mp_sales_mp_costs';

    SELECT COALESCE(SUM(revenue), 0) INTO v_total_revenue
    FROM mp_sales
    WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id);

    WITH costs_agg AS (
      SELECT
        COALESCE(SUM(commission), 0) as commission,
        COALESCE(SUM(logistics), 0) as logistics,
        COALESCE(SUM(storage), 0) as storage,
        COALESCE(SUM(promotion), 0) as promotion,
        COALESCE(SUM(penalties), 0) as penalties,
        COALESCE(SUM(acquiring), 0) as acquiring,
        COALESCE(SUM(other_costs), 0) as other_costs,
        COALESCE(SUM(total_costs), 0) as total
      FROM mp_costs
      WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
        AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
        AND (p_product_id IS NULL OR product_id = p_product_id)
        AND (p_user_id IS NULL OR user_id = p_user_id)
    )
    SELECT json_build_array(
      json_build_object('name', 'Продажи', 'amount', v_total_revenue, 'percent', NULL, 'children', '[]'::json),
      json_build_object('name', 'Комиссия', 'amount', -commission, 'percent', NULL, 'children', '[]'::json),
      json_build_object('name', 'Логистика', 'amount', -logistics, 'percent', NULL, 'children', '[]'::json),
      json_build_object('name', 'Хранение', 'amount', -storage, 'percent', NULL, 'children', '[]'::json),
      json_build_object('name', 'Продвижение', 'amount', -promotion, 'percent', NULL, 'children', '[]'::json),
      json_build_object('name', 'Штрафы', 'amount', -penalties, 'percent', NULL, 'children', '[]'::json),
      json_build_object('name', 'Эквайринг', 'amount', -acquiring, 'percent', NULL, 'children', '[]'::json),
      json_build_object('name', 'Прочее', 'amount', -other_costs, 'percent', NULL, 'children', '[]'::json)
    ) INTO v_tree FROM costs_agg;

    v_percent_base_sales := v_total_revenue;
    v_total_accrued := v_total_revenue - (
      SELECT COALESCE(SUM(total_costs), 0) FROM mp_costs
      WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
        AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
        AND (p_product_id IS NULL OR product_id = p_product_id)
        AND (p_user_id IS NULL OR user_id = p_user_id)
    );
  END IF;

  RETURN json_build_object(
    'status', 'success',
    'period', json_build_object('from', p_date_from, 'to', p_date_to),
    'marketplace', COALESCE(p_marketplace, 'all'),
    'total_accrued', v_total_accrued,
    'total_revenue', v_total_revenue,
    'percent_base_sales', v_percent_base_sales,
    'source', v_source,
    'tree', COALESCE(v_tree, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.3 get_costs_tree_combined
CREATE OR REPLACE FUNCTION get_costs_tree_combined(
  p_date_from TEXT,
  p_date_to TEXT,
  p_product_id UUID DEFAULT NULL,
  p_include_children BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_ozon_tree JSON;
  v_wb_tree JSON;
BEGIN
  SELECT get_costs_tree(p_date_from, p_date_to, 'ozon', p_product_id, p_include_children, p_user_id) INTO v_ozon_tree;
  SELECT get_costs_tree(p_date_from, p_date_to, 'wb', p_product_id, p_include_children, p_user_id) INTO v_wb_tree;

  RETURN json_build_object(
    'ozon', v_ozon_tree,
    'wb', v_wb_tree,
    'period', json_build_object('from', p_date_from, 'to', p_date_to)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.4 get_dashboard_summary_with_prev
CREATE OR REPLACE FUNCTION get_dashboard_summary_with_prev(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_include_costs_tree_revenue BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_current_summary JSON;
  v_prev_summary JSON;
  v_period_days INT;
  v_prev_from TEXT;
  v_prev_to TEXT;
  v_ozon_revenue NUMERIC;
  v_prev_ozon_revenue NUMERIC;
  v_current_revenue NUMERIC;
  v_prev_revenue NUMERIC;
  v_revenue_change NUMERIC;
BEGIN
  v_period_days := (p_date_to::DATE - p_date_from::DATE) + 1;
  v_prev_to := (p_date_from::DATE - INTERVAL '1 day')::DATE::TEXT;
  v_prev_from := (p_date_from::DATE - (v_period_days || ' days')::INTERVAL)::DATE::TEXT;

  SELECT get_dashboard_summary(p_date_from, p_date_to, p_marketplace, p_user_id) INTO v_current_summary;
  SELECT get_dashboard_summary(v_prev_from, v_prev_to, p_marketplace, p_user_id) INTO v_prev_summary;

  IF p_include_costs_tree_revenue AND (p_marketplace IS NULL OR p_marketplace = 'all' OR p_marketplace = 'ozon') THEN
    SELECT COALESCE(
      (SELECT SUM(amount) FROM (
        SELECT (elem->>'amount')::NUMERIC as amount
        FROM json_array_elements(
          (SELECT get_costs_tree(p_date_from, p_date_to, 'ozon', NULL, FALSE, p_user_id)::JSON->'tree')
        ) elem
        WHERE elem->>'name' = 'Продажи'
      ) sub), 0
    ) INTO v_ozon_revenue;

    SELECT COALESCE(
      (SELECT SUM(amount) FROM (
        SELECT (elem->>'amount')::NUMERIC as amount
        FROM json_array_elements(
          (SELECT get_costs_tree(v_prev_from, v_prev_to, 'ozon', NULL, FALSE, p_user_id)::JSON->'tree')
        ) elem
        WHERE elem->>'name' = 'Продажи'
      ) sub), 0
    ) INTO v_prev_ozon_revenue;
  ELSE
    v_ozon_revenue := 0;
    v_prev_ozon_revenue := 0;
  END IF;

  v_current_revenue := COALESCE((v_current_summary->'summary'->>'revenue')::NUMERIC, 0);
  v_prev_revenue := COALESCE((v_prev_summary->'summary'->>'revenue')::NUMERIC, 0);

  IF p_include_costs_tree_revenue AND (p_marketplace IS NULL OR p_marketplace = 'all') THEN
    DECLARE
      v_ozon_sales_revenue NUMERIC;
      v_prev_ozon_sales_revenue NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(revenue), 0) INTO v_ozon_sales_revenue
      FROM mp_sales
      WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE AND marketplace = 'ozon'
        AND (p_user_id IS NULL OR user_id = p_user_id);

      SELECT COALESCE(SUM(revenue), 0) INTO v_prev_ozon_sales_revenue
      FROM mp_sales
      WHERE date >= v_prev_from::DATE AND date <= v_prev_to::DATE AND marketplace = 'ozon'
        AND (p_user_id IS NULL OR user_id = p_user_id);

      v_current_revenue := v_current_revenue - v_ozon_sales_revenue + v_ozon_revenue;
      v_prev_revenue := v_prev_revenue - v_prev_ozon_sales_revenue + v_prev_ozon_revenue;
    END;
  ELSIF p_include_costs_tree_revenue AND p_marketplace = 'ozon' THEN
    v_current_revenue := v_ozon_revenue;
    v_prev_revenue := v_prev_ozon_revenue;
  END IF;

  IF v_prev_revenue > 0 THEN
    v_revenue_change := ROUND(((v_current_revenue - v_prev_revenue) / v_prev_revenue) * 100, 1);
  ELSE
    v_revenue_change := 0;
  END IF;

  RETURN json_build_object(
    'summary', v_current_summary->'summary',
    'previous_period', json_build_object(
      'revenue', v_prev_revenue,
      'orders', COALESCE((v_prev_summary->'summary'->>'orders')::INT, 0),
      'sales', COALESCE((v_prev_summary->'summary'->>'sales')::INT, 0),
      'revenue_change_percent', v_revenue_change
    ),
    'period', json_build_object('from', p_date_from, 'to', p_date_to),
    'prev_period', json_build_object('from', v_prev_from, 'to', v_prev_to),
    'adjusted_revenue', json_build_object(
      'current', v_current_revenue,
      'previous', v_prev_revenue,
      'ozon_truth_current', v_ozon_revenue,
      'ozon_truth_previous', v_prev_ozon_revenue
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- ЧАСТЬ 5: ПРОВЕРКА
-- =============================================

SELECT 'Tables created:' as info, count(*) as cnt
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'mp_%';

SELECT 'RPC functions:' as info, routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_dashboard_summary', 'get_costs_tree', 'get_costs_tree_combined', 'get_dashboard_summary_with_prev');
