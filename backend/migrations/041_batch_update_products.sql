-- Migration 041: Batch update products RPC
-- Replaces N+1 queries in reorder_products and import_prices endpoints
-- 2026-03-30

CREATE OR REPLACE FUNCTION batch_update_products(
    p_user_id UUID,
    p_updates JSONB  -- [{"id": "uuid", "purchase_price": 280, "sort_order": 0}, ...]
) RETURNS INT AS $$
DECLARE
    updated INT := 0;
    item JSONB;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        UPDATE mp_products
        SET
            purchase_price = COALESCE((item->>'purchase_price')::numeric, purchase_price),
            sort_order = COALESCE((item->>'sort_order')::int, sort_order),
            updated_at = now()
        WHERE id = (item->>'id')::uuid AND user_id = p_user_id;
        IF FOUND THEN updated := updated + 1; END IF;
    END LOOP;
    RETURN updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
