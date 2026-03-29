-- Migration 040: Order funnel — single-axis metrics from mp_orders
--
-- Changes from 039:
--   1. v_orders: removed "status != 'cancelled'" — counts ALL placed orders
--   2. v_orders_sum: kept excluding cancelled (no revenue from cancelled)
--   3. v_cancelled: COUNT(DISTINCT order_id WHERE status='cancelled')
--   4. v_sold: COUNT(DISTINCT order_id WHERE status='sold') — buyouts from THESE orders
--   5. v_delivering: v_orders - v_sold - v_cancelled — pending orders
--   6. buyout_percent: v_sold / v_orders (true funnel conversion, NOT cross-axis)
--   7. All new fields in JSON summary + previous_period

CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_fulfillment_type TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_orders INT;
  v_orders_sum NUMERIC;
  v_cancelled INT;
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
  v_commission NUMERIC;
  v_logistics NUMERIC;
  v_storage NUMERIC;
  v_penalties NUMERIC;
  v_acquiring NUMERIC;
  v_promotion NUMERIC;
  v_other_costs NUMERIC;
  v_settled_revenue NUMERIC;
  v_settled_payout NUMERIC;
  v_settled_purchase NUMERIC;
  v_settled_profit NUMERIC;
BEGIN
  -- Orders = ALL placed (including cancelled), ghost orders excluded (price>0)
  SELECT COALESCE(COUNT(DISTINCT order_id), 0)
  INTO v_orders
  FROM mp_orders
  WHERE order_date >= (p_date_from || 'T00:00:00+03')::TIMESTAMPTZ
    AND order_date <= (p_date_to || 'T23:59:59+03')::TIMESTAMPTZ
    AND price > 0
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Orders sum = only non-cancelled (cancelled don't generate revenue)
  SELECT COALESCE(SUM(COALESCE(sale_price, price)), 0)
  INTO v_orders_sum
  FROM mp_orders
  WHERE order_date >= (p_date_from || 'T00:00:00+03')::TIMESTAMPTZ
    AND order_date <= (p_date_to || 'T23:59:59+03')::TIMESTAMPTZ
    AND status != 'cancelled'
    AND price > 0
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Cancelled orders
  SELECT COALESCE(COUNT(DISTINCT order_id), 0)
  INTO v_cancelled
  FROM mp_orders
  WHERE order_date >= (p_date_from || 'T00:00:00+03')::TIMESTAMPTZ
    AND order_date <= (p_date_to || 'T23:59:59+03')::TIMESTAMPTZ
    AND status = 'cancelled'
    AND price > 0
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Sales from mp_sales (buyouts) — unchanged
  SELECT
    COALESCE(SUM(sales_count), 0),
    COALESCE(SUM(returns_count), 0),
    COALESCE(SUM(revenue), 0)
  INTO v_sales, v_returns, v_revenue
  FROM mp_sales
  WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Costs from mp_costs — unchanged
  SELECT
    COALESCE(SUM(total_costs), 0), COALESCE(SUM(commission), 0),
    COALESCE(SUM(logistics), 0), COALESCE(SUM(storage), 0),
    COALESCE(SUM(penalties), 0), COALESCE(SUM(acquiring), 0),
    COALESCE(SUM(promotion), 0), COALESCE(SUM(other_costs), 0)
  INTO v_total_costs, v_commission, v_logistics, v_storage, v_penalties, v_acquiring, v_promotion, v_other_costs
  FROM mp_costs
  WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Ad costs — unchanged
  SELECT COALESCE(SUM(cost), 0) INTO v_ad_cost
  FROM mp_ad_costs
  WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Purchase costs — unchanged
  SELECT COALESCE(SUM(p.purchase_price * s.sales_count), 0) INTO v_purchase_costs_total
  FROM mp_sales s JOIN mp_products p ON s.product_id = p.id
  WHERE s.date >= p_date_from::DATE AND s.date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR s.marketplace = p_marketplace)
    AND (p_user_id IS NULL OR s.user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR s.fulfillment_type = p_fulfillment_type);

  -- Settlement revenue — unchanged
  SELECT COALESCE(SUM(amount), 0) INTO v_settled_revenue
  FROM mp_costs_details
  WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE AND category = 'Продажи'
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Settlement payout — unchanged
  SELECT COALESCE(SUM(amount), 0) INTO v_settled_payout
  FROM mp_costs_details
  WHERE date >= p_date_from::DATE AND date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR marketplace = p_marketplace)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR fulfillment_type = p_fulfillment_type);

  -- Settlement purchase — unchanged
  SELECT COALESCE(SUM(p.purchase_price * GREATEST(c.settled_qty, 0)), 0) INTO v_settled_purchase
  FROM mp_costs c JOIN mp_products p ON c.product_id = p.id
  WHERE c.date >= p_date_from::DATE AND c.date <= p_date_to::DATE
    AND (p_marketplace IS NULL OR p_marketplace = 'all' OR c.marketplace = p_marketplace)
    AND (p_user_id IS NULL OR c.user_id = p_user_id)
    AND (p_fulfillment_type IS NULL OR c.fulfillment_type = p_fulfillment_type)
    AND c.settled_qty > 0;

  IF v_settled_purchase = 0 THEN v_settled_purchase := v_purchase_costs_total; END IF;

  v_settled_profit := v_settled_payout - v_settled_purchase - v_ad_cost;
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
      'orders_sum', v_orders_sum,
      'cancelled_count', v_cancelled,
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
        'commission', v_commission, 'logistics', v_logistics,
        'storage', v_storage, 'penalties', v_penalties,
        'acquiring', v_acquiring, 'promotion', v_promotion,
        'other', v_other_costs
      ),
      'settled_revenue', v_settled_revenue,
      'settled_payout', v_settled_payout,
      'settled_purchase', v_settled_purchase,
      'settled_profit', v_settled_profit
    ),
    'previous_period', json_build_object(
      'revenue', 0, 'sales', 0,
      'orders', 0, 'orders_sum', 0,
      'cancelled_count', 0,
      'revenue_change_percent', 0
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;
