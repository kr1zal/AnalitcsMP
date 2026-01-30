-- =============================================
-- Оптимизированные RPC функции для дашборда
-- Выполнить в Supabase SQL Editor
-- =============================================

-- Индексы для ускорения запросов (если ещё не созданы)
CREATE INDEX IF NOT EXISTS idx_mp_sales_date_mp ON mp_sales(date, marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_costs_date_mp ON mp_costs(date, marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_date_mp ON mp_costs_details(date, marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_ad_costs_date_mp ON mp_ad_costs(date, marketplace);

-- =============================================
-- 1. get_costs_tree_combined: объединяет ozon и wb в 1 запрос
-- Экономит 1 HTTP запрос при marketplace=all
-- =============================================
CREATE OR REPLACE FUNCTION get_costs_tree_combined(
  p_date_from TEXT,
  p_date_to TEXT,
  p_product_id UUID DEFAULT NULL,
  p_include_children BOOLEAN DEFAULT TRUE
) RETURNS JSON AS $$
DECLARE
  v_ozon_tree JSON;
  v_wb_tree JSON;
BEGIN
  -- Получаем дерево для Ozon
  SELECT get_costs_tree(p_date_from, p_date_to, 'ozon', p_product_id, p_include_children) INTO v_ozon_tree;

  -- Получаем дерево для WB
  SELECT get_costs_tree(p_date_from, p_date_to, 'wb', p_product_id, p_include_children) INTO v_wb_tree;

  RETURN json_build_object(
    'ozon', v_ozon_tree,
    'wb', v_wb_tree,
    'period', json_build_object('from', p_date_from, 'to', p_date_to)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- 2. get_dashboard_summary_with_prev: summary + prev period в 1 запрос
-- Экономит 3-4 HTTP запроса при marketplace=all
-- =============================================
CREATE OR REPLACE FUNCTION get_dashboard_summary_with_prev(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_include_costs_tree_revenue BOOLEAN DEFAULT TRUE
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

  -- Получаем текущий summary
  SELECT get_dashboard_summary(p_date_from, p_date_to, p_marketplace) INTO v_current_summary;

  -- Получаем предыдущий summary
  SELECT get_dashboard_summary(v_prev_from, v_prev_to, p_marketplace) INTO v_prev_summary;

  -- Если нужна "истинная" выручка из costs-tree для Ozon
  IF p_include_costs_tree_revenue AND (p_marketplace IS NULL OR p_marketplace = 'all' OR p_marketplace = 'ozon') THEN
    -- Текущий период: выручка Ozon из costs-tree
    SELECT COALESCE(
      (SELECT SUM(amount) FROM (
        SELECT (elem->>'amount')::NUMERIC as amount
        FROM json_array_elements(
          (SELECT get_costs_tree(p_date_from, p_date_to, 'ozon', NULL, FALSE)::JSON->'tree')
        ) elem
        WHERE elem->>'name' = 'Продажи'
      ) sub), 0
    ) INTO v_ozon_revenue;

    -- Предыдущий период: выручка Ozon из costs-tree
    SELECT COALESCE(
      (SELECT SUM(amount) FROM (
        SELECT (elem->>'amount')::NUMERIC as amount
        FROM json_array_elements(
          (SELECT get_costs_tree(v_prev_from, v_prev_to, 'ozon', NULL, FALSE)::JSON->'tree')
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
    -- Нужно получить отдельно Ozon revenue из mp_sales для вычитания
    DECLARE
      v_ozon_sales_revenue NUMERIC;
      v_prev_ozon_sales_revenue NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(revenue), 0) INTO v_ozon_sales_revenue
      FROM mp_sales
      WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE AND marketplace = 'ozon';

      SELECT COALESCE(SUM(revenue), 0) INTO v_prev_ozon_sales_revenue
      FROM mp_sales
      WHERE date >= v_prev_from::DATE AND date <= v_prev_to::DATE AND marketplace = 'ozon';

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

-- =============================================
-- Комментарии для документации
-- =============================================
COMMENT ON FUNCTION get_costs_tree_combined IS 'Объединённый запрос costs-tree для ozon и wb. Экономит 1 HTTP запрос при marketplace=all.';
COMMENT ON FUNCTION get_dashboard_summary_with_prev IS 'Summary с данными предыдущего периода и "истинной" выручкой Ozon из costs-tree. Экономит 3-4 HTTP запроса.';
