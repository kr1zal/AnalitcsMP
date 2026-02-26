-- Migration 028: Add quantity column to mp_orders
-- Needed for order-based purchase calculation (purchase_price * quantity)
-- WB: always 1 (per srid), Ozon: can be >1 per product in posting
-- Run in Supabase SQL Editor

ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
