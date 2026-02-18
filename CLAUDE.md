Never run "npm run dev"
Use "npm run build" to check if code compiles or no. See results and fix code if it's needed
Пиши ответы на Русском
Read and follow coding standards: .claude/rules/coding-standards.md
# Analytics Dashboard — WB & Ozon

5 SKU (витамины/БАДы), SaaS, per-user auth. **Production:** https://reviomp.ru

| VPS | Beget 83.222.16.15, Ubuntu 24.04 | SSH: `ssh root@83.222.16.15` пароль: `@vnDBp5VCt2+` |
|-----|-----------------------------------|------------------------------------------------------|
| Структура | `/var/www/analytics/` | systemd `analytics-api`, Nginx, Let's Encrypt |
| Supabase | reviomp (xpushkwswfbkdkbmghux) | Admin: exklante@gmail.com / `e2db2023-4ce3-4182-96d3-7a194657cb4a` |

**Стек:** Python 3.14 + FastAPI | React 19 + TS 5.9 + Vite 7 + Tailwind 3 | Supabase (PostgreSQL + RLS) | React Query 5 + Zustand 5

## Deployed (подробности → [docs/phases-history.md](docs/phases-history.md))
- SaaS Phase 1-4: Auth+RLS, Onboarding, Subscriptions, Sync Queue
- Order Monitor v1 (воронка) + v2 (позаказная детализация)
- Landing Page + DataFlowV3 + MatrixRain
- YooKassa Payment (ShopID: 1273909)
- Auth Flow (signup, reset, delete)
- Product Management (drag&drop, groups, CC)
- UE Profit Fix + P1 (ДРР, прогноз остатков)
- СПП в Продажах (credits included)
- Прибыль per OZON/WB в карточках MarketplaceBreakdown
- Dashboard v2: ProfitWaterfall + ProfitChart + TopProductsChart + ConversionChart
- План продаж: 3 уровня (total → per-MP → per-product), completion card, UE column
- Enterprise Settings: unified `/settings` с 5 табами (Подключения, Товары, План продаж, Тариф, Профиль)
- Sales Plan Audit: 6 багфиксов (completion inflation, per-MP actual, weighted avg, FeatureGate, SaveInput, warnings)

## Активные задачи
- [x] Hide Business tier, SEO index.html, admin ID→config — CLOSED
- [x] Возвраты + ДРР от заказов/выкупов — CLOSED
- [x] Enterprise Settings: объединение Синхронизация + Настройки + Аккаунт — DONE (18.02.2026)
- [ ] Улучшить PDF экспорт

## Архитектурные решения (НЕ МЕНЯТЬ — 29 правил)
1. **Costs-tree:** отдельные параллельные запросы per marketplace (НЕ combined)
2. **AccrualsCards:** данные через props из DashboardPage
3. **DateRangePicker:** `captionLayout="label"` (НЕ dropdown)
4. **Tailwind v3** (НЕ v4)
5. **PDF:** Playwright backend (НЕ html2canvas)
6. **Auth:** Hybrid — service_role_key backend + RLS safety net + JWT JWKS
7. **Шифрование:** Fernet backend (НЕ pgcrypto/Vault)
8. **Подписки:** планы в коде plans.py (НЕ в БД)
9. **Sync:** DB queue + cron (НЕ Celery — 1 ядро VPS)
10. **Прибыль:** пропорциональная коррекция закупки через costsTreeRatio
11. **Order Monitor v1:** из mp_sales, непроведённые из costs-tree RPC
12. **Order Monitor v2:** mp_orders, WB srid 3-step accumulate, Ozon FBS+FBO
13. **WB SPP:** sale_price = retail_price_withdisc_rub (после СПП)
14. **Landing Hero:** Canvas MatrixRain
15. **DataFlow PRO:** скрыт `SHOW_PRO = false` (НЕ удалён)
16. **Pricing:** всегда `grid-cols-2`
17. **Product Management:** 3-col, @dnd-kit, click modals (НЕ hover)
18. **UE Profit:** `profit_i = total_payout × (revenue_i / Σrevenue) - purchase×ratio - ad×ratio`
19. **СПП:** credits ВХОДЯТ в displayed_revenue. Ratio = ЧИСТЫЕ sales (без credits)
20. **WB Методология:** ВЕРИФИЦИРОВАНА (аудит 15.02.2026). Двойного учёта СПП нет. Подробности → docs/phases-history.md
21. **OZON Методология:** ВЕРИФИЦИРОВАНА (аудит 15.02.2026). Diff с ЛК = 0.00₽ по всем категориям. Нет credits. Подробности → docs/phases-history.md
22. **ProfitChart:** dual area (revenue+profit), profitMargin=netProfit/revenue, daily estimate. Заменяет AvgCheckChart
23. **ProfitWaterfall:** div-based bars (НЕ Recharts). Пропорции от revenue. Скрывает нулевые строки
24. **TopProductsChart:** top 5 + link "все N →" UE page. Масштабируется на 100+ SKU
25. **ConversionChart:** `sales/orders × 100%`, lazy-loaded, sky-blue (#0ea5e9)
26. **Dashboard layout (lg+):** 2x2 charts grid (Sales|Profit, DRR|Conversion) + analytics row (Waterfall|TopProducts)
27. **Sales Plan:** 3 уровня (total → per-MP → per-product). Приоритет completion: total > MP > product. Факт ТОЛЬКО за месяцы с планом (НЕ за весь date range дашборда). Сброс: `DELETE /sales-plan/reset`. `mp_sales_plan` (per-product) + `mp_sales_plan_summary` (total/MP)
28. **Dashboard Cards:** grid 4×2 (`grid-cols-2 lg:grid-cols-4`). Enterprise SummaryCard с accent-иконками, secondaryValue, ChangeBadge. Row1: Заказы|Выкупы|Себестоимость|Чист.прибыль. Row2: Удержания|Реклама+ДРР|К перечисл.|Δ/Рентабельность. ДРР merged в Реклама (НЕ отдельная карточка). Period comparison через ChangeBadge (НЕ отдельные карточки)
29. **Enterprise Settings:** unified `/settings?tab=` (НЕ отдельные /sync, /settings, аккаунт-блок). 5 табов: Подключения|Товары|**План продаж**|Тариф|Профиль. URL state через `useSearchParams`. Desktop: vertical sidebar (md+). Mobile: horizontal scroll pills. SyncingOverlay как full-screen фаза (idle→syncing→done). `/sync` → redirect `/settings?tab=connections`. ARIA: tablist/tab/tabpanel
30. **Sales Plan completion:** actual только по МП с планами (`active_mps`). Per-MP actual из wbData/ozonData (НЕ planData.by_product). Footer = взвешенное completion (НЕ простое среднее). SaveInput: skip server sync при focus. Warnings при Σ(МП)>total

## Формулы (КРИТИЧНО)
```
profit = total_payout - purchase×costsTreeRatio - ads×costsTreeRatio
costsTreeRatio = costs_tree_SALES / mp_sales_revenue  (БЕЗ credits!)
displayed_revenue = costs_tree_sales + credits (СПП, возмещения)
UE: profit_i = total_payout × (revenue_i / Σrevenue) - purchase_i×ratio - ad_i×ratio
DRR = ad_cost / revenue × 100%
Stock forecast: days_remaining = quantity / avg_daily_sales(30d)
Per-MP profit: profit_mp = payout_mp - purchase×share - ad×share (share=pureSales_mp/totalPureSales)
WB Начислено = total_accrued = SUM(all tree items) = Продажи + Credits + Удержания
WB Продажи_display = pure_sales + credits (СПП/возмещения)
OZON Начислено = total_accrued = SUM(all tree items) = Продажи + Удержания (нет credits)
OZON Продажи = tree["Продажи"] (Выручка + Баллы + Партнёры, как в ЛК)
ProfitChart daily: profitMargin = netProfit / revenueForTile; dailyProfit = dailyRevenue × profitMargin
Waterfall: revenue → −mpDeductions → −purchase → −ads = profit (margin%)
TopProducts: sort by net_profit desc, show top 5, filter WB_ACCOUNT
Conversion: sales / orders × 100% (выкуп %)
Plan completion: actual ONLY for months WITH a plan. Priority: total > MP-sum > product-sum. Reset: deletes both tables for month
```

## Источники данных
- `mp_sales.revenue` — все заказы (вкл. непроведённые)
- `costs_tree "Продажи"` — финализированные из финотчёта
- Плашка "Продажи" = costs_tree_sales + credits
- WB credits = положительные tree items кроме "Продажи"

## Локальная разработка
```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev  # port 5173. НИКОГДА npm run dev для ПРОВЕРКИ — только npm run build
```

## Документация
| Файл | Содержимое |
|------|-----------|
| [docs/phases-history.md](docs/phases-history.md) | Подробная история всех фаз |
| [backend/README.md](backend/README.md) | API endpoints, БД, auth, .env |
| [frontend/README.md](frontend/README.md) | Компоненты, hooks, pages |
| [.claude/rules/coding-standards.md](.claude/rules/coding-standards.md) | Стандарты кода (React, FastAPI, Tailwind) |
| [docs/yookassa-integration.md](docs/yookassa-integration.md) | ЮКасса API + webhook |
| [docs/auth-flow.md](docs/auth-flow.md) | CJM авторизации |
| [docs/product-management.md](docs/product-management.md) | Управление товарами |
