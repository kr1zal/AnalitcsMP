-- 016: Summary-level sales plans (total / per-marketplace)
-- 3 уровня: total → по МП → по товарам (mp_sales_plan)

CREATE TABLE IF NOT EXISTS mp_sales_plan_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,               -- первый день месяца (2026-02-01)
  level VARCHAR(20) NOT NULL CHECK (level IN ('total', 'wb', 'ozon')),
  plan_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_sales_plan_summary UNIQUE (user_id, month, level)
);

CREATE INDEX IF NOT EXISTS idx_sales_plan_summary_user_month
  ON mp_sales_plan_summary(user_id, month);

ALTER TABLE mp_sales_plan_summary ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own summary plans"
  ON mp_sales_plan_summary FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own summary plans"
  ON mp_sales_plan_summary FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own summary plans"
  ON mp_sales_plan_summary FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own summary plans"
  ON mp_sales_plan_summary FOR DELETE
  USING (user_id = auth.uid());
