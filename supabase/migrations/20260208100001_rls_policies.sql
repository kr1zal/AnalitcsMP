-- =============================================
-- 005: RLS (Row Level Security) политики
-- Защита данных на уровне БД — каждый пользователь видит только свои данные
-- service_role_key обходит RLS (бэкенд работает без ограничений)
-- =============================================

-- Включить RLS на всех mp_* таблицах
ALTER TABLE mp_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_costs_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_sales_geo ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_ad_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_sync_log ENABLE ROW LEVEL SECURITY;

-- mp_products
CREATE POLICY "Users see own products" ON mp_products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON mp_products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON mp_products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON mp_products FOR DELETE USING (auth.uid() = user_id);

-- mp_sales
CREATE POLICY "Users see own sales" ON mp_sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sales" ON mp_sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sales" ON mp_sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sales" ON mp_sales FOR DELETE USING (auth.uid() = user_id);

-- mp_stocks
CREATE POLICY "Users see own stocks" ON mp_stocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own stocks" ON mp_stocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own stocks" ON mp_stocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own stocks" ON mp_stocks FOR DELETE USING (auth.uid() = user_id);

-- mp_costs
CREATE POLICY "Users see own costs" ON mp_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own costs" ON mp_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own costs" ON mp_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own costs" ON mp_costs FOR DELETE USING (auth.uid() = user_id);

-- mp_costs_details
CREATE POLICY "Users see own costs_details" ON mp_costs_details FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own costs_details" ON mp_costs_details FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own costs_details" ON mp_costs_details FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own costs_details" ON mp_costs_details FOR DELETE USING (auth.uid() = user_id);

-- mp_sales_geo
CREATE POLICY "Users see own sales_geo" ON mp_sales_geo FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sales_geo" ON mp_sales_geo FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sales_geo" ON mp_sales_geo FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sales_geo" ON mp_sales_geo FOR DELETE USING (auth.uid() = user_id);

-- mp_ad_costs
CREATE POLICY "Users see own ad_costs" ON mp_ad_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ad_costs" ON mp_ad_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ad_costs" ON mp_ad_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ad_costs" ON mp_ad_costs FOR DELETE USING (auth.uid() = user_id);

-- mp_sync_log
CREATE POLICY "Users see own sync_log" ON mp_sync_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sync_log" ON mp_sync_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sync_log" ON mp_sync_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sync_log" ON mp_sync_log FOR DELETE USING (auth.uid() = user_id);
