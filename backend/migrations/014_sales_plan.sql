-- Migration 014: Sales plan (monthly revenue target per product)
-- Users input a revenue target per product per calendar month

CREATE TABLE IF NOT EXISTS mp_sales_plan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES mp_products(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  plan_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_sales_plan UNIQUE (user_id, product_id, month)
);

CREATE INDEX IF NOT EXISTS idx_sales_plan_user_month
  ON mp_sales_plan(user_id, month);

-- RLS
ALTER TABLE mp_sales_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_plan_select ON mp_sales_plan
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY sales_plan_insert ON mp_sales_plan
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY sales_plan_update ON mp_sales_plan
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY sales_plan_delete ON mp_sales_plan
  FOR DELETE USING (user_id = auth.uid());
