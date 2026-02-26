-- =============================================
-- 025: Fix RPC get_dashboard_summary — агрегация costs_breakdown
--
-- ПРОБЛЕМА: costs_breakdown в ответе RPC всегда возвращал нули:
--   costs_breakdown: {commission: 0, logistics: 0, storage: 0, penalties: 0, acquiring: 0, other: 0}
--   Хотя данные есть в mp_costs (колонки commission, logistics, storage, promotion, penalties, acquiring, other_costs).
--
-- РЕШЕНИЕ: Агрегировать SUM по колонкам mp_costs и включить в costs_breakdown.
-- =============================================

DROP FUNCTION IF EXISTS get_dashboard_summary(text, text, text, uuid, text);

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
  -- costs_breakdown fields
  v_commission NUMERIC;
  v_logistics NUMERIC;
  v_storage NUMERIC;
  v_penalties NUMERIC;
  v_acquiring NUMERIC;
  v_promotion NUMERIC;
  v_other_costs NUMERIC;
BEGIN
  -- Агрегация продаж (из mp_sales — дата заказа)
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

  -- Агрегация удержаний (из mp_costs — settlement date) + breakdown
  SELECT
    COALESCE(SUM(total_costs), 0),
    COALESCE(SUM(commission), 0),
    COALESCE(SUM(logistics), 0),
    COALESCE(SUM(storage), 0),
    COALESCE(SUM(penalties), 0),
    COALESCE(SUM(acquiring), 0),
    COALESCE(SUM(promotion), 0),
    COALESCE(SUM(other_costs), 0)
  INTO v_total_costs, v_commission, v_logistics, v_storage, v_penalties, v_acquiring, v_promotion, v_other_costs
  FROM mp_costs
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Ad costs (account-level, NOT filtered by fulfillment_type)
  SELECT COALESCE(SUM(cost), 0)
  INTO v_ad_cost
  FROM mp_ad_costs
  WHERE date >= p_date_from::DATE
    AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Purchase: ВСЕГДА order-based из mp_sales (одна ось с revenue)
  SELECT COALESCE(SUM(p.purchase_price * s.sales_count), 0)
  INTO v_purchase_costs_total
  FROM mp_sales s
  JOIN mp_products p ON s.product_id = p.id
  WHERE s.date >= p_date_from::DATE AND s.date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR s.marketplace = p_marketplace)
    AND (p_user_id IS NULL OR s.user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR s.fulfillment_type = p_fulfillment_type);

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
        'commission', v_commission,
        'logistics', v_logistics,
        'storage', v_storage,
        'penalties', v_penalties,
        'acquiring', v_acquiring,
        'promotion', v_promotion,
        'other', v_other_costs
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

-- get_dashboard_summary_with_prev пересоздаём (вызывает обновлённый get_dashboard_summary)
DROP FUNCTION IF EXISTS get_dashboard_summary_with_prev(text, text, text, boolean, uuid, text);

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

  v_revenue_change := CASE
    WHEN v_prev_revenue > 0 THEN ROUND(((v_current_revenue - v_prev_revenue) / v_prev_revenue) * 100, 1)
    ELSE 0
  END;

  RETURN json_build_object(
    'status', (v_current_summary->>'status'),
    'period', (v_current_summary->'period'),
    'marketplace', (v_current_summary->>'marketplace'),
    'summary', (v_current_summary->'summary'),
    'previous_period', json_build_object(
      'revenue', COALESCE((v_prev_summary->'summary'->>'revenue')::NUMERIC, 0),
      'sales', COALESCE((v_prev_summary->'summary'->>'sales')::INT, 0),
      'orders', COALESCE((v_prev_summary->'summary'->>'orders')::INT, 0),
      'revenue_change_percent', v_revenue_change,
      'net_profit', COALESCE((v_prev_summary->'summary'->>'net_profit')::NUMERIC, 0),
      'ad_cost', COALESCE((v_prev_summary->'summary'->>'ad_cost')::NUMERIC, 0),
      'purchase_costs_total', COALESCE((v_prev_summary->'summary'->>'purchase_costs_total')::NUMERIC, 0),
      'total_costs', COALESCE((v_prev_summary->'summary'->>'total_costs')::NUMERIC, 0)
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;
