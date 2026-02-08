-- =============================================
-- 006: Обновление RPC функций с поддержкой user_id
-- Добавляет p_user_id UUID DEFAULT NULL во все 4 функции
-- DEFAULT NULL обеспечивает обратную совместимость
-- Выполнить в Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. get_dashboard_summary: + p_user_id
-- =============================================
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
  -- Агрегация продаж
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

  -- Агрегация удержаний
  SELECT COALESCE(SUM(total_costs), 0)
  INTO v_total_costs
  FROM mp_costs
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Агрегация рекламы
  SELECT COALESCE(SUM(cost), 0)
  INTO v_ad_cost
  FROM mp_ad_costs
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Закупочная стоимость (purchase_price * sales_count)
  SELECT COALESCE(SUM(p.purchase_price * s.sales_count), 0)
  INTO v_purchase_costs_total
  FROM mp_sales s
  JOIN mp_products p ON s.product_id = p.id
  WHERE s.date >= p_date_from::DATE
    AND s.date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR s.marketplace = p_marketplace)
    AND (p_user_id IS NULL OR s.user_id = p_user_id);

  -- Расчёт метрик
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
        'commission', 0,
        'logistics', 0,
        'storage', 0,
        'penalties', 0,
        'acquiring', 0,
        'other', 0
      )
    ),
    'previous_period', json_build_object(
      'revenue', 0,
      'sales', 0,
      'orders', 0,
      'revenue_change_percent', 0
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- 2. get_costs_tree: + p_user_id
-- =============================================
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
  -- Проверяем, есть ли детализация в mp_costs_details
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

    -- Строим дерево из mp_costs_details
    WITH categories AS (
      SELECT
        category,
        SUM(amount) as total_amount,
        json_agg(
          json_build_object(
            'name', subcategory,
            'amount', amount
          )
        ) FILTER (WHERE p_include_children AND subcategory IS NOT NULL AND subcategory != category) as children
      FROM (
        SELECT
          category,
          subcategory,
          SUM(amount) as amount
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
    SELECT
      json_agg(
        json_build_object(
          'name', category,
          'amount', total_amount,
          'percent', NULL,
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
      )
    INTO v_tree
    FROM categories;

    -- Получаем базу для процентов (категория "Продажи")
    SELECT COALESCE(ABS(SUM(amount)), 0)
    INTO v_percent_base_sales
    FROM mp_costs_details
    WHERE date >= p_date_from::DATE
      AND date <= p_date_to::DATE
      AND category = 'Продажи'
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id);

    -- Общая сумма начислений
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_accrued
    FROM mp_costs_details
    WHERE date >= p_date_from::DATE
      AND date <= p_date_to::DATE
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id);

    v_total_revenue := v_percent_base_sales;

  ELSE
    -- Fallback: строим из mp_costs + mp_sales
    v_source := 'fallback_mp_sales_mp_costs';

    -- Выручка из mp_sales
    SELECT COALESCE(SUM(revenue), 0)
    INTO v_total_revenue
    FROM mp_sales
    WHERE date >= p_date_from::DATE
      AND date <= p_date_to::DATE
      AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_user_id IS NULL OR user_id = p_user_id);

    -- Удержания из mp_costs
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
      WHERE date >= p_date_from::DATE
        AND date <= p_date_to::DATE
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
    )
    INTO v_tree
    FROM costs_agg;

    v_percent_base_sales := v_total_revenue;
    v_total_accrued := v_total_revenue - (
      SELECT COALESCE(SUM(total_costs), 0)
      FROM mp_costs
      WHERE date >= p_date_from::DATE
        AND date <= p_date_to::DATE
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

-- =============================================
-- 3. get_costs_tree_combined: + p_user_id
-- =============================================
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

-- =============================================
-- 4. get_dashboard_summary_with_prev: + p_user_id
-- =============================================
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
  -- Вычисляем длительность периода
  v_period_days := (p_date_to::DATE - p_date_from::DATE) + 1;

  -- Вычисляем даты предыдущего периода
  v_prev_to := (p_date_from::DATE - INTERVAL '1 day')::DATE::TEXT;
  v_prev_from := (p_date_from::DATE - (v_period_days || ' days')::INTERVAL)::DATE::TEXT;

  -- Получаем текущий summary (с p_user_id)
  SELECT get_dashboard_summary(p_date_from, p_date_to, p_marketplace, p_user_id) INTO v_current_summary;

  -- Получаем предыдущий summary (с p_user_id)
  SELECT get_dashboard_summary(v_prev_from, v_prev_to, p_marketplace, p_user_id) INTO v_prev_summary;

  -- Если нужна "истинная" выручка из costs-tree для Ozon
  IF p_include_costs_tree_revenue AND (p_marketplace IS NULL OR p_marketplace = 'all' OR p_marketplace = 'ozon') THEN
    -- Текущий период: выручка Ozon из costs-tree
    SELECT COALESCE(
      (SELECT SUM(amount) FROM (
        SELECT (elem->>'amount')::NUMERIC as amount
        FROM json_array_elements(
          (SELECT get_costs_tree(p_date_from, p_date_to, 'ozon', NULL, FALSE, p_user_id)::JSON->'tree')
        ) elem
        WHERE elem->>'name' = 'Продажи'
      ) sub), 0
    ) INTO v_ozon_revenue;

    -- Предыдущий период: выручка Ozon из costs-tree
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

  -- Вычисляем итоговую выручку с учётом "истинной" Ozon выручки
  v_current_revenue := COALESCE((v_current_summary->'summary'->>'revenue')::NUMERIC, 0);
  v_prev_revenue := COALESCE((v_prev_summary->'summary'->>'revenue')::NUMERIC, 0);

  -- Для marketplace=all или ozon заменяем Ozon-часть выручки
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

      -- Заменяем Ozon-часть на "истинную"
      v_current_revenue := v_current_revenue - v_ozon_sales_revenue + v_ozon_revenue;
      v_prev_revenue := v_prev_revenue - v_prev_ozon_sales_revenue + v_prev_ozon_revenue;
    END;
  ELSIF p_include_costs_tree_revenue AND p_marketplace = 'ozon' THEN
    v_current_revenue := v_ozon_revenue;
    v_prev_revenue := v_prev_ozon_revenue;
  END IF;

  -- Вычисляем процент изменения
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
    'period', json_build_object(
      'from', p_date_from,
      'to', p_date_to
    ),
    'prev_period', json_build_object(
      'from', v_prev_from,
      'to', v_prev_to
    ),
    'adjusted_revenue', json_build_object(
      'current', v_current_revenue,
      'previous', v_prev_revenue,
      'ozon_truth_current', v_ozon_revenue,
      'ozon_truth_previous', v_prev_ozon_revenue
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Проверка
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_dashboard_summary', 'get_costs_tree', 'get_costs_tree_combined', 'get_dashboard_summary_with_prev');
