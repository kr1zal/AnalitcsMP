# История фаз проекта (подробности)

## SaaS Phase 1: Auth + RLS — DEPLOYED (08.02.2026)
- JWT middleware (JWKS), RLS на всех таблицах, user_id во всех данных
- Cron: X-Cron-Secret + X-Cron-User-Id headers
- Подробности: [../memory/saas-phase1.md](../memory/saas-phase1.md)

## SaaS Phase 2: Onboarding — DEPLOYED (09.02.2026)
- Fernet encryption, mp_user_tokens таблица, SettingsPage
- ProtectedRoute → redirect /settings если нет токенов
- Подробности: [../memory/saas-phase2.md](../memory/saas-phase2.md)

## SaaS Phase 3: Subscription Tiers — DEPLOYED (09.02.2026)
- 3 тарифа: Free / Pro (990₽) / Business (2990₽), без оплаты (admin-managed)
- Backend: plans.py, subscription.py (Depends), feature gates на dashboard/export/sync
- Frontend: FeatureGate (blur+lock), SubscriptionCard, plan badge в header
- Подробности: [../memory/saas-phase3.md](../memory/saas-phase3.md)

## SaaS Phase 4: Sync Queue — DEPLOYED (09.02.2026)
- DB-based queue (mp_sync_queue) + cron `/sync/process-queue` каждые 30 мин
- Расписание: Business 06/12/18/00 MSK, Pro +1ч, Free 08:00/20:00
- Ручной sync: Free:0, Pro:1/день, Business:2/день
- Endpoint: POST /sync/manual, GET /sync/status, POST /admin/sync/{user_id}
- SyncPage: статус-панель + кнопка "Обновить сейчас" + история
- Подробности: [../memory/saas-phase4.md](../memory/saas-phase4.md)

## Order Monitor v1 (Воронка) — READY (09.02.2026)
- Агрегированная воронка заказов: Заказы → Выкупы → Возвраты (из mp_sales)
- Pro/Business фича: feature gate `order_monitor` в plans.py
- Индикатор непроведённых: сравнение mp_sales.revenue vs costs-tree settled
- Backend: GET /dashboard/order-funnel (dashboard.py)

## Order Monitor v2 (Позаказная детализация + SPP fix) — READY (10.02.2026)
- Таблица mp_orders: одна строка = один заказ/отправление (migration 011)
- WB sync: 3-step enrichment (get_orders → get_sales → get_report_detail), accumulate financial data
- Ozon sync: FBS + FBO (get_posting_fbs_list + get_posting_fbo_list), per-product financials
- Ozon posting_status format: "FBO:delivered", "FBS:cancelled"
- **sale_price:** WB retail_price_withdisc_rub (после СПП), Ozon = price
- Backend: GET /dashboard/orders (пагинация+фильтры), GET /dashboard/orders/{id}
- Frontend: позаказная таблица, мобильные карточки, пагинация 50/стр

## Phase 5: Landing Page — DEPLOYED (10-14.02.2026)
- `frontend/src/pages/LandingPage.tsx` (~2000 lines, все секции в одном файле)
- Route `/` для неавторизованных → Landing, авторизованные → `/app`
- Зависимости: @fontsource/inter, swiper (карусель)
- Секции: NavBar, Hero, TrustBar, DashboardCarousel, StatsBar, Problem, Features, DataFlowV3, HowItWorks, Security, Pricing, FAQ, FinalCTA, Footer
- DataFlowV3: desktop SVG (1000×590) + mobile SVG (300×450)
- PRO блок: скрыт через `SHOW_PRO = false`
- Pricing: всегда grid-cols-2
- MatrixRain: canvas-based digital rain (hero), indigo/violet colors

## Phase 5: YooKassa Payment — TESTED & DEPLOYED (14.02.2026)
- Интеграция оплаты Pro подписки (990₽/мес) через ЮКассу (httpx, без SDK)
- ShopID: 1273909 (live), тестовый: 1276568
- Эндпоинты: POST /subscription/upgrade, POST /subscription/webhook, POST /subscription/cancel, POST /subscription/enable-auto-renew
- Webhook: IP whitelist + двойная верификация платежа
- Подробности: [yookassa-integration.md](yookassa-integration.md)

## Auth Flow — DEPLOYED (14.02.2026)
- LoginPage: 3 режима (login, signup, forgot-password) + emailRedirectTo
- ResetPasswordPage: ввод нового пароля после перехода по ссылке
- Удаление аккаунта: Danger Zone в SettingsPage → DELETE /api/v1/account
- Email-шаблоны: брендированные (RevioMP, indigo-600), на русском
- Подробности: [auth-flow.md](auth-flow.md)

## Product Management — DEPLOYED (15.02.2026)
- Компонент: `frontend/src/components/Settings/ProductManagement.tsx` (~700 строк)
- Drag & Drop: @dnd-kit, сортировка, связки (groups), себестоимость (CC)
- Backend: 5 эндпоинтов в products.py
- Migration 013: sort_order + product_group_id
- Подробности: [product-management.md](product-management.md)

## UE Profit Fix + P1 Features (15.02.2026)
- UE profit = Dashboard profit: пропорциональное распределение payout по товарам
- P1.1 ДРР по товарам: `ad_cost / revenue × 100%`
- P1.2 Прогноз остатков: `days_remaining = total_quantity / avg_daily_sales(30d)`

## СПП в Продажах — DEPLOYED (15.02.2026)
- WB credits (СПП, возмещения) включены в "Продажи" везде
- displayed_revenue = costs_tree_sales + credits
- costsTreeRatio использует ЧИСТЫЕ продажи (без credits)
- Сноска "вкл. СПП +X₽" на WB карточке

## Прибыль per OZON/WB — DEPLOYED (15.02.2026)
- Прибыль в карточках MarketplaceBreakdown: `profit_mp = payout_mp - purchase×share - ad×share`
- HelpCircle тултипы на всех метриках (Продажи, Начислено, Прибыль)
- Суммы без символа ₽ (мобильная оптимизация)

---

## WB Методология расчётов — ФИНАЛ (аудит 15.02.2026)

**Статус: ВЕРИФИЦИРОВАН на реальных данных. Двойного учёта СПП нет.**

### Источник данных
Таблица `mp_costs_details` (из WB финансового отчёта API). Каждая строка = операция с полями: `category`, `subcategory`, `amount` (±), `date`, `marketplace`, `user_id`.

### SQL RPC `get_costs_tree()`
Агрегирует `mp_costs_details` по `category`, строит дерево. Ключевые расчёты:
- `total_accrued = SUM(ALL amounts)` — итоговая выплата от WB
- `percent_base_sales = ABS(SUM(amounts WHERE category='Продажи'))` — база для %

### Структура дерева (tree)
```
Продажи:          +N  (чистые продажи — ПОЛОЖИТЕЛЬНОЕ)
Вознаграждение:   -N  (комиссия WB)
Доставка:         -N  (логистика)
Хранение:         -N
Эквайринг:        -N
Прочие/СПП:       +N  (CREDIT — положительное, не «Продажи»)
Возмещения:       +N  (CREDIT)
```

### Инвариант (проверен)
```
total_accrued = Σ(все tree items) = Продажи + Credits + Удержания
Пример: 7866 + 3243 + (-2713) = 8396 = total_accrued ✓
```

### Метрики Dashboard → WB Card

| Метрика | Формула | Что показывает |
|---------|---------|----------------|
| **Продажи** | `salesItem.amount + creditsTotal` | Чистые продажи + СПП/возмещения |
| **Начислено** | `total_accrued` (из RPC) | Реальная выплата от WB |
| **Удержания** | `SUM(negative tree items)` | Комиссия + доставка + хранение + ... |
| **Прибыль** | `total_accrued - purchase×ratio - ad×ratio` | Чистая прибыль |

### costsTreeRatio
```
costsTreeRatio = pure_sales / mp_sales_revenue
```
- `pure_sales` = tree item "Продажи" (БЕЗ credits/СПП)
- Credits НЕ входят в ratio — они компенсация от МП, не от продаж
- Ratio = доля проведённых заказов (1.0 = все заказы проведены)

### Per-marketplace profit
```
share = pureSales_mp / totalPureSales (OZON+WB)
profit_mp = payout_mp - adjustedPurchase×share - ad×share
```
Гарантия: `profit_ozon + profit_wb = dashboard_profit`

### Почему двойного учёта СПП НЕТ
1. СПП входит в `total_accrued` (пейаут) через SUM всех amounts в SQL
2. `displayed_revenue` (Продажи + credits) используется ТОЛЬКО для отображения
3. `costsTreeRatio` использует чистые sales (без credits)
4. Прибыль считается от `total_accrued` (пейаут), НЕ от `displayed_revenue`
5. Сходимость: `displayed_revenue + удержания = начислено` ✓

## Исправленные баги
- Плашки "Пред.пер." не показывают данные (commit 1aa095f)
- `secret_key = "change-me-in-production"` в config.py (удалён)
- Нет concurrent sync protection (sync guard + lock)
- Ozon SKU mapping hardcoded (dynamic from DB + migration 009)
- Прибыль -10К из-за смешивания costs-tree и mp_sales (пропорциональная коррекция)
- WB mp_orders: price = retail_price ДО скидки (sale_price column added)
- save-and-sync 500: trigger "onboarding" не в CHECK constraint (заменён на "manual")
