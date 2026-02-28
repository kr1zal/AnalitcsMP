-- Migration 035b: Scale fixes v2 (Rule #49 — 200+ SKU, 10+ sellers)
-- Fixes: PERF-002 (N+1 UPDATE), PERF-003 (URL overflow), DATA-002 (imprecise JOIN)
-- Replaces failed 035: removed UNIQUE index (table uses DELETE+INSERT, not UPSERT),
-- removed SECURITY DEFINER (backend uses service_role_key).

-- 1. posting_number column already added by partially-applied 035.
-- Re-run is safe: IF NOT EXISTS.
ALTER TABLE mp_costs_details ADD COLUMN IF NOT EXISTS posting_number VARCHAR(100);

-- 2. Drop failed UNIQUE index from 035 attempt (if it somehow exists)
DROP INDEX IF EXISTS idx_mp_costs_details_unique_v2;

-- 3. Non-unique index for posting_number lookups (used in RPC JOIN)
CREATE INDEX IF NOT EXISTS idx_mp_costs_details_posting
    ON mp_costs_details(user_id, marketplace, posting_number)
    WHERE posting_number IS NOT NULL;

-- 4. PERF-002 fix: Batch UPDATE delivery_dates via single SQL (replaces N+1 HTTP calls)
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

-- 5. PERF-003 + DATA-002 fix: Single RPC replaces double IN() + imprecise JOIN
-- Returns delivered orders (source='order') and their costs (source='cost') in one call.
-- Uses posting_number for exact JOIN, falls back to (product_id, order_date) for legacy data.
-- NOTE: posting_number format may differ between Finance API (len(items)) and Postings API
-- (len(products_list)) for edge cases (partial cancellation). The (product_id, order_date)
-- fallback handles these cases.
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
    -- Exact JOIN by posting_number (preferred) with (product_id, order_date) fallback
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
                -- Preferred: exact match by posting_number → order_id
                (cd.posting_number IS NOT NULL AND o.order_id = cd.posting_number)
                OR
                -- Fallback: match by (product_id, order_date) for legacy data without posting_number
                (cd.posting_number IS NULL AND cd.order_date IS NOT NULL
                 AND cd.order_date = (o.order_date AT TIME ZONE 'Europe/Moscow')::DATE)
            )
      );
END;
$$ LANGUAGE plpgsql;
