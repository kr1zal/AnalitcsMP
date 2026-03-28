-- Migration 037: UE Ozon — use status='sold' instead of delivery_date
--
-- Problem: RPC 036 required delivery_date IS NOT NULL AND delivery_date <= period_end.
-- But delivery_date comes from CSV Postings Report (24h sync), while status='sold'
-- comes from FBO/FBS list API (6h sync). Result: orders delivered between syncs
-- had status='sold' + full finance but delivery_date = NULL → invisible to UE.
--
-- Additionally, delivery_date <= period_end was wrong: Ozon LK counts orders
-- PLACED in period that have been delivered (at any time), not limited by period end.
--
-- Fix: Replace delivery_date conditions with status = 'sold'.
-- STATUS_MAP in sync_service.py: Ozon "delivered" → our "sold" (line 2801).
-- This is the ONLY path to status='sold' for Ozon orders.
--
-- Safety:
--   - order_date IN period filter preserved (Phase 1 fix intact)
--   - Python still counts delivered by "Выручка" finance records (line 478)
--   - Orders without finance settlement are naturally excluded
--   - delivery_date continues to sync for display purposes
--
-- Expected result (19-24 Mar test): 6 → 11 delivered, matching Ozon LK exactly.

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
    -- Part 1: Orders placed in period that have been delivered
    -- Matches Ozon LK: order_date IN period AND status = delivered
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
      AND o.status = 'sold'
      -- Ordered in period (MSK):
      AND o.order_date >= (p_date_from || 'T00:00:00+03')::TIMESTAMPTZ
      AND o.order_date <= (p_date_to || 'T23:59:59+03')::TIMESTAMPTZ
      AND (p_fulfillment_type IS NULL OR o.fulfillment_type = p_fulfillment_type);

    -- Part 2: Costs for delivered orders
    -- JOIN by posting_number (exact or prefix) with (product_id, order_date) fallback
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
            AND o.status = 'sold'
            -- Same filter as Part 1:
            AND o.order_date >= (p_date_from || 'T00:00:00+03')::TIMESTAMPTZ
            AND o.order_date <= (p_date_to || 'T23:59:59+03')::TIMESTAMPTZ
            AND (p_fulfillment_type IS NULL OR o.fulfillment_type = p_fulfillment_type)
            AND cd.product_id = o.product_id
            AND (
                -- Primary: exact posting_number match
                (cd.posting_number IS NOT NULL AND o.order_id = cd.posting_number)
                OR
                -- Primary: base posting_number match (Finance API sometimes omits item suffix)
                (cd.posting_number IS NOT NULL AND o.order_id LIKE cd.posting_number || '-%')
                OR
                -- Fallback: (product_id, order_date) for legacy data without posting_number
                (cd.posting_number IS NULL AND cd.order_date IS NOT NULL
                 AND cd.order_date = (o.order_date AT TIME ZONE 'Europe/Moscow')::DATE)
            )
      );
END;
$$ LANGUAGE plpgsql;
