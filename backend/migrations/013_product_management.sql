-- Migration 013: Product management (sort_order, product_group_id)
-- Adds columns for product ordering and cross-marketplace linking

-- 1. Add sort_order for display ordering within marketplace columns
ALTER TABLE mp_products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Add product_group_id for linking products across marketplaces
ALTER TABLE mp_products ADD COLUMN IF NOT EXISTS product_group_id UUID DEFAULT NULL;

-- 3. Index for fast group lookups (partial — only non-NULL)
CREATE INDEX IF NOT EXISTS idx_mp_products_group ON mp_products(product_group_id) WHERE product_group_id IS NOT NULL;

-- 4. Index for sorting
CREATE INDEX IF NOT EXISTS idx_mp_products_sort ON mp_products(user_id, sort_order);
