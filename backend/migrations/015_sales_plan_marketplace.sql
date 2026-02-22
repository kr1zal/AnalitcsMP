-- 015: Добавляем marketplace в mp_sales_plan для раздельных планов WB/Ozon
-- Они суммируются в общий план при marketplace='all'

-- 1. Добавить колонку
ALTER TABLE mp_sales_plan ADD COLUMN marketplace VARCHAR(10) NOT NULL DEFAULT 'wb';

-- 2. Убрать старый unique constraint
ALTER TABLE mp_sales_plan DROP CONSTRAINT IF EXISTS uq_sales_plan;

-- 3. Новый unique constraint (user_id, product_id, month, marketplace)
ALTER TABLE mp_sales_plan ADD CONSTRAINT uq_sales_plan UNIQUE (user_id, product_id, month, marketplace);

-- 4. Обновить индекс
DROP INDEX IF EXISTS idx_sales_plan_user_month;
CREATE INDEX idx_sales_plan_user_month ON mp_sales_plan(user_id, month, marketplace);
