-- =============================================
-- Migration 018: FBS Support — fulfillment_type column
-- Adds fulfillment_type VARCHAR(10) DEFAULT 'FBO' to 6 tables
-- Updates UNIQUE constraints and RPC functions
-- =============================================

BEGIN;

-- =============================================
-- PART 1: ADD COLUMN (all existing rows → 'FBO')
-- =============================================

ALTER TABLE mp_sales ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(10) NOT NULL DEFAULT 'FBO';
ALTER TABLE mp_costs ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(10) NOT NULL DEFAULT 'FBO';
ALTER TABLE mp_costs_details ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(10) NOT NULL DEFAULT 'FBO';
ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(10) NOT NULL DEFAULT 'FBO';
ALTER TABLE mp_stocks ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(10) NOT NULL DEFAULT 'FBO';
ALTER TABLE mp_stock_snapshots ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(10) NOT NULL DEFAULT 'FBO';

-- =============================================
-- PART 2: UPDATE UNIQUE CONSTRAINTS
-- mp_orders: NOT changed (order_id is unique per MP, order is either FBO or FBS)
-- mp_costs_details: no UNIQUE (only PK)
-- =============================================

-- mp_sales: (user_id, product_id, marketplace, date) → add fulfillment_type
ALTER TABLE mp_sales DROP CONSTRAINT IF EXISTS mp_sales_user_product_mp_date_key;
ALTER TABLE mp_sales ADD CONSTRAINT mp_sales_user_product_mp_date_ft_key
  UNIQUE (user_id, product_id, marketplace, date, fulfillment_type);

-- mp_costs: (user_id, product_id, marketplace, date) → add fulfillment_type
ALTER TABLE mp_costs DROP CONSTRAINT IF EXISTS mp_costs_user_product_mp_date_key;
ALTER TABLE mp_costs ADD CONSTRAINT mp_costs_user_product_mp_date_ft_key
  UNIQUE (user_id, product_id, marketplace, date, fulfillment_type);

-- mp_stocks: (user_id, product_id, marketplace, warehouse) → add fulfillment_type
ALTER TABLE mp_stocks DROP CONSTRAINT IF EXISTS mp_stocks_user_product_mp_wh_key;
ALTER TABLE mp_stocks ADD CONSTRAINT mp_stocks_user_product_mp_wh_ft_key
  UNIQUE (user_id, product_id, marketplace, warehouse, fulfillment_type);

-- mp_stock_snapshots: (user_id, product_id, marketplace, date) → add fulfillment_type
ALTER TABLE mp_stock_snapshots DROP CONSTRAINT IF EXISTS mp_stock_snapshots_user_product_mp_date_key;
ALTER TABLE mp_stock_snapshots ADD CONSTRAINT mp_stock_snapshots_user_product_mp_date_ft_key
  UNIQUE (user_id, product_id, marketplace, date, fulfillment_type);

-- =============================================
-- PART 3: INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_mp_sales_fulfillment ON mp_sales(user_id, fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_mp_costs_fulfillment ON mp_costs(user_id, fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_fulfillment ON mp_costs_details(user_id, fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_mp_orders_fulfillment ON mp_orders(user_id, fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_mp_stocks_fulfillment ON mp_stocks(user_id, fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_mp_stock_snapshots_fulfillment ON mp_stock_snapshots(user_id, fulfillment_type);

-- =============================================
-- PART 4: RPC FUNCTIONS (with p_fulfillment_type parameter)
-- =============================================

-- 4.0 Drop old overloads (without p_fulfillment_type param) to avoid PostgREST ambiguity
DROP FUNCTION IF EXISTS get_dashboard_summary(text, text, text, uuid);
DROP FUNCTION IF EXISTS get_costs_tree(text, text, text, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS get_costs_tree_combined(text, text, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS get_dashboard_summary_with_prev(text, text, text, boolean, uuid);

-- 4.1 get_dashboard_summary
CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_fulfillment_type TEXT DEFAULT NULL
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
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  SELECT COALESCE(SUM(total_costs), 0)
  INTO v_total_costs
  FROM mp_costs
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Ad costs: NOT filtered by fulfillment_type (ad campaigns are account-level)
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
    AND (p_user_id IS NULL OR s.user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR s.fulfillment_type = p_fulfillment_type);

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
  p_user_id UUID DEFAULT NULL,
  p_fulfillment_type TEXT DEFAULT NULL
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
      AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type)
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
          AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type)
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
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

    SELECT COALESCE(SUM(amount), 0) INTO v_total_accrued
    FROM mp_costs_details
    WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

    v_total_revenue := v_percent_base_sales;

  ELSE
    v_source := 'fallback_mp_sales_mp_costs';

    SELECT COALESCE(SUM(revenue), 0) INTO v_total_revenue
    FROM mp_sales
    WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

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
        AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type)
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
        AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type)
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

-- 4.3 get_costs_tree_combined (passes fulfillment_type through)
CREATE OR REPLACE FUNCTION get_costs_tree_combined(
  p_date_from TEXT,
  p_date_to TEXT,
  p_product_id UUID DEFAULT NULL,
  p_include_children BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL,
  p_fulfillment_type TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_ozon_tree JSON;
  v_wb_tree JSON;
BEGIN
  SELECT get_costs_tree(p_date_from, p_date_to, 'ozon', p_product_id, p_include_children, p_user_id, p_fulfillment_type) INTO v_ozon_tree;
  SELECT get_costs_tree(p_date_from, p_date_to, 'wb', p_product_id, p_include_children, p_user_id, p_fulfillment_type) INTO v_wb_tree;

  RETURN json_build_object(
    'ozon', v_ozon_tree,
    'wb', v_wb_tree,
    'period', json_build_object('from', p_date_from, 'to', p_date_to)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.4 get_dashboard_summary_with_prev (passes fulfillment_type through)
CREATE OR REPLACE FUNCTION get_dashboard_summary_with_prev(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_include_costs_tree_revenue BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL,
  p_fulfillment_type TEXT DEFAULT NULL
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

  SELECT get_dashboard_summary(p_date_from, p_date_to, p_marketplace, p_user_id, p_fulfillment_type) INTO v_current_summary;
  SELECT get_dashboard_summary(v_prev_from, v_prev_to, p_marketplace, p_user_id, p_fulfillment_type) INTO v_prev_summary;

  IF p_include_costs_tree_revenue AND (p_marketplace IS NULL OR p_marketplace = 'all' OR p_marketplace = 'ozon') THEN
    SELECT COALESCE(
      (SELECT SUM(amount) FROM (
        SELECT (elem->>'amount')::NUMERIC as amount
        FROM json_array_elements(
          (SELECT get_costs_tree(p_date_from, p_date_to, 'ozon', NULL, FALSE, p_user_id, p_fulfillment_type)::JSON->'tree')
        ) elem
        WHERE elem->>'name' = 'Продажи'
      ) sub), 0
    ) INTO v_ozon_revenue;

    SELECT COALESCE(
      (SELECT SUM(amount) FROM (
        SELECT (elem->>'amount')::NUMERIC as amount
        FROM json_array_elements(
          (SELECT get_costs_tree(v_prev_from, v_prev_to, 'ozon', NULL, FALSE, p_user_id, p_fulfillment_type)::JSON->'tree')
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
        AND (p_user_id IS NULL OR user_id = p_user_id)
        AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

      SELECT COALESCE(SUM(revenue), 0) INTO v_prev_ozon_sales_revenue
      FROM mp_sales
      WHERE date >= v_prev_from::DATE AND date <= v_prev_to::DATE AND marketplace = 'ozon'
        AND (p_user_id IS NULL OR user_id = p_user_id)
        AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

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
-- PART 5: VERIFICATION
-- =============================================

-- Verify columns exist
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'fulfillment_type'
  AND table_name IN ('mp_sales', 'mp_costs', 'mp_costs_details', 'mp_orders', 'mp_stocks', 'mp_stock_snapshots')
ORDER BY table_name;

-- Verify all existing data is FBO
SELECT 'mp_sales' as tbl, fulfillment_type, count(*) FROM mp_sales GROUP BY fulfillment_type
UNION ALL
SELECT 'mp_costs', fulfillment_type, count(*) FROM mp_costs GROUP BY fulfillment_type
UNION ALL
SELECT 'mp_orders', fulfillment_type, count(*) FROM mp_orders GROUP BY fulfillment_type;

COMMIT;
