-- Migration 027: Add cancel reason columns to mp_orders
-- Stores cancellation reasons for Ozon orders (FBS: text, FBO: cancel_reason_id)
-- Run in Supabase SQL Editor

ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(200);
ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS cancellation_initiator VARCHAR(20);

-- Index for filtering by cancellation initiator (e.g. "client", "seller", "ozon")
CREATE INDEX IF NOT EXISTS idx_mp_orders_cancel_initiator
    ON mp_orders(user_id, cancellation_initiator)
    WHERE cancellation_initiator IS NOT NULL AND cancellation_initiator != '';
