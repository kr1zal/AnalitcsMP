-- Migration 035: Scale fixes (Rule #49 — 200+ SKU, 10+ sellers)
-- Fixes: PERF-002 (N+1 UPDATE), PERF-003 (URL overflow), DATA-002 (imprecise JOIN)
--
-- HISTORY: Original version had a UNIQUE index that failed (23505 — duplicate rows).
-- mp_costs_details uses DELETE+INSERT pattern, not UPSERT → UNIQUE index unnecessary.
-- Also removed SECURITY DEFINER (backend uses service_role_key, bypasses RLS).
-- Fixed version: 035b_scale_fixes_v2.sql (apply that instead).
--
-- STATUS: SUPERSEDED by 035b. DO NOT APPLY this file.

-- 1. posting_number in mp_costs_details for exact JOIN with mp_orders
ALTER TABLE mp_costs_details ADD COLUMN IF NOT EXISTS posting_number VARCHAR(100);

-- 2. Non-unique index for posting_number lookups (used in RPC JOIN)
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_posting
    ON mp_costs_details(user_id, marketplace, posting_number)
    WHERE posting_number IS NOT NULL;

-- 3. PERF-002 fix: Batch UPDATE delivery_dates via single SQL (replaces N+1 HTTP calls)
CREATE OR REPLACE FUNCTION batch_update_delivery_dates(
    p_user_id UUID,
    p_order_ids TEXT[],
    p_delivery_dates TIMESTAMPTZ[],
    p_quantities INT[]
) RETURNS INT AS $$
DECLARE v_count INT;
BEGIN
    WITH updates AS (
        SELECT
            unnest(p_order_ids) AS order_id,
            unnest(p_delivery_dates) AS delivery_date,
            unnest(p_quantities) AS quantity
    )
    UPDATE mp_orders o
    SET
        delivery_date = u.delivery_date,
        quantity = CASE WHEN u.quantity > 0 THEN u.quantity ELSE o.quantity END
    FROM updates u
    WHERE o.user_id = p_user_id
      AND o.marketplace = 'ozon'
      AND o.order_id = u.order_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 4. PERF-003 + DATA-002 fix: Single RPC replaces double IN() + imprecise JOIN
CREATE OR REPLACE FUNCTION get_ozon_ue_delivered(
    p_user_id UUID,
    p_date_from TEXT,
    p_date_to TEXT,
    p_fulfillment_type TEXT DEFAULT NULL
) RETURNS TABLE (
    source TEXT,
    product_id UUID,
    order_date TEXT,
    quantity INT,
    category TEXT,
    subcategory TEXT,
    amount NUMERIC,
    fulfillment_type TEXT
) AS $$
BEGIN
    -- Part 1: Delivered orders (for counting delivered_qty per product)
    RETURN QUERY
    SELECT
        'order'::TEXT,
        o.product_id,
        (o.order_date AT TIME ZONE 'Europe/Moscow')::DATE::TEXT,
        COALESCE(o.quantity, 1),
        NULL::TEXT,
        NULL::TEXT,
        NULL::NUMERIC,
        o.fulfillment_type::TEXT
    FROM mp_orders o
    WHERE o.user_id = p_user_id
      AND o.marketplace = 'ozon'
      AND o.delivery_date IS NOT NULL
      AND o.delivery_date >= (p_date_from || 'T00:00:00+03')::TIMESTAMPTZ
      AND o.delivery_date <= (p_date_to || 'T23:59:59+03')::TIMESTAMPTZ
      AND (p_fulfillment_type IS NULL OR o.fulfillment_type = p_fulfillment_type);

    -- Part 2: Costs for delivered orders
    RETURN QUERY
    SELECT
        'cost'::TEXT,
        cd.product_id,
        cd.order_date::TEXT,
        NULL::INT,
        cd.category::TEXT,
        cd.subcategory::TEXT,
        cd.amount,
        cd.fulfillment_type::TEXT
    FROM mp_costs_details cd
    WHERE cd.user_id = p_user_id
      AND cd.marketplace = 'ozon'
      AND (p_fulfillment_type IS NULL OR cd.fulfillment_type = p_fulfillment_type)
      AND EXISTS (
          SELECT 1 FROM mp_orders o
          WHERE o.user_id = p_user_id
            AND o.marketplace = 'ozon'
            AND o.delivery_date IS NOT NULL
            AND o.delivery_date >= (p_date_from || 'T00:00:00+03')::TIMESTAMPTZ
            AND o.delivery_date <= (p_date_to || 'T23:59:59+03')::TIMESTAMPTZ
            AND (p_fulfillment_type IS NULL OR o.fulfillment_type = p_fulfillment_type)
            AND cd.product_id = o.product_id
            AND (
                (cd.posting_number IS NOT NULL AND o.order_id = cd.posting_number)
                OR
                (cd.posting_number IS NULL AND cd.order_date IS NOT NULL
                 AND cd.order_date = (o.order_date AT TIME ZONE 'Europe/Moscow')::DATE)
            )
      );
END;
$$ LANGUAGE plpgsql;
