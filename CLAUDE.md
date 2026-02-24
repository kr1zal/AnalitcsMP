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
- Sales Plan Enterprise v2: PlanCompletionCard v2 (темп/прогноз/дни), Stock Alert, Copy Plan
- FBS Sync: определение FBO/FBS при синхронизации WB + Ozon (миграция 018, RPC с p_fulfillment_type)

## Активные задачи
- [x] Hide Business tier, SEO index.html, admin ID→config — CLOSED
- [x] Возвраты + ДРР от заказов/выкупов — CLOSED
- [x] Enterprise Settings: объединение Синхронизация + Настройки + Аккаунт — DONE (18.02.2026)
- [x] FBS Sync pipeline: WB isSupply + Ozon delivery_schema — DONE (20.02.2026)
- [ ] UE с разбивкой FBO/FBS
- [ ] Улучшить PDF экспорт

## Архитектурные решения (НЕ МЕНЯТЬ — 43 правила)
1. **Costs-tree:** отдельные параллельные запросы per marketplace (НЕ combined)
2. **AccrualsCards:** данные через props из DashboardPage
3. **DateRangePicker:** `captionLayout="label"` (НЕ dropdown)
4. **Tailwind v3** (НЕ v4)
5. **PDF:** Playwright backend (НЕ html2canvas)
6. **Auth:** Hybrid — service_role_key backend + RLS safety net + JWT JWKS
7. **Шифрование:** Fernet backend (НЕ pgcrypto/Vault)
8. **Подписки:** планы в коде plans.py (НЕ в БД)
9. **Sync:** DB queue + cron (НЕ Celery — 1 ядро VPS)
10. **Прибыль:** COGS = purchase_price × sales_count (БЕЗ коэффициентов). profit = payout - purchase - ads
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
31. **Sales Plan v2:** PlanCompletionCard v2 (pace/forecast/days + кликабельность). StockPlanAlerts (self-contained, useStocks). Copy plan (НЕ auto-suggest — удалён как сырой). Month state поднят в PlanTab (НЕ дублировать getCurrentMonth). salesPlanApi с generic типами
32. **FBS pills:** ВСЕГДА видны в FilterPanel (Все|FBO|FBS). НИКОГДА не скрывать, не удалять. Если FBS-данных нет — кнопка FBS disabled (серая, некликабельная). FBS — фича продукта, пользователь должен видеть что аналитика FBS поддерживается. `useFulfillmentInfo` хук для проверки наличия данных
33. **FBS Sync:** WB: приоритет полей `isSupply → delivery_type_id → delivery_method → srv_dbs → default FBO`. Ozon costs: `posting.delivery_schema` из `/v3/finance/transaction/list`. Ozon sales (analytics API) — НЕТ FBS разбивки, остаётся FBO default. WB stocks — нет надёжного поля, FBO default. Хелпер: `SyncService._determine_wb_fulfillment(row)`. Миграция 018: колонка `fulfillment_type VARCHAR(10) DEFAULT 'FBO'` в 6 таблицах, RPC с `p_fulfillment_type`
34. **UE FBO/FBS Breakdown:** ТОЛЬКО в раскрытой MpCard (НЕ в свёрнутой карточке). Backend: `fulfillment_breakdown` для ВСЕХ товаров с продажами (НЕ только FBS). Feature gate: `fbs_analytics` (Pro+). Два режима FtRow: single (без шкалы, подпись "маржинальность") и dual (шкала доли выручки + заголовок). Пропорция: FBO%+FBS%=100% (base=sum ft_revenue). Реклама: `ad_ft = ad × (ft_rev / mp_sales_rev)`. Benchmark цвета: ≥25% emerald, ≥15% sky, ≥10% amber, ≥5% orange, <5% red. Naming: "маржинальность" (НЕ "маржа"). Цвета шкал: gray=FBO, blue=FBS
35. **Costs-tree FBO/FBS merge:** При `fulfillment_type=NULL` ("Все") хелпер `_fetch_costs_tree_merged()` делает 2 RPC (FBO+FBS) и мержит. WB `mp_costs_details` может не иметь FBS (reportDetailByPeriod не отдаёт `isSupply`). FBS берётся из fallback (mp_sales+mp_costs). Merge суммирует `total_accrued`, `total_revenue`, объединяет tree items по name. Применено: costs-tree, costs-tree-combined, UE, Order Monitor
36. **MarketplaceBreakdown независим от фильтра МП:** Карточки OZON/WB ВСЕГДА загружают costs-tree данные (enabled: true). Глобальный фильтр МП НЕ скрывает карточки. Фильтры карточек: только период дат + FBO/FBS
37. **Stocks независимы от фильтра МП:** StocksTable, StockForecastChart, StockHistoryChart ВСЕГДА показывают все МП (marketplace='all'). StocksTable имеет встроенные фильтры (Все/OOS WB/OOS Ozon). Остатки — текущее состояние склада, НЕ аналитика за период
38. **FilterPanel sticky:** `sticky top-0 z-30` на обоих layout (mobile + desktop). Панель прилипает при скролле. Паттерн GA/Mixpanel/Shopify. НЕ убирать z-30 (перекрывает контент ниже)
39. **Sidebar Dashboard:** ТОЛЬКО фильтр товаров (per-product drill-down для графиков). МП-фильтр УДАЛЁН из сайдбара — все секции (карточки, графики, остатки) следуют единому глобальному фильтру из FilterPanel. Причина: два независимых МП-фильтра создавали путаницу (карточки показывали WB, графики — все МП)
40. **URL state sync:** `useFilterUrlSync` хук — двусторонняя синхронизация Zustand ↔ URL. Params: `?period=30d&mp=wb&ft=FBS&from=YYYY-MM-DD&to=YYYY-MM-DD`. Дефолтные значения (7d, all, all) НЕ пишутся в URL. `replaceState` (НЕ pushState). Сохраняет чужие query params. Хук подключен в FilterPanel (НЕ в каждой странице)
41. **AdsPage sticky:** Страница рекламы имеет свою панель фильтров (НЕ общий FilterPanel). Sticky классы: mobile `sticky top-0 z-30`, desktop `sticky top-16 z-30`. НЕ заменять на общий FilterPanel — AdsPage использует локальный МП-фильтр (`selectedMarketplace` useState)
42. **Даты ВСЕГДА в МСК TZ:** `getMaxAvailableDateYmd()` и `getTodayYmd()` форматируют через `toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })`. НИКОГДА не использовать `format(new Date(), 'yyyy-MM-dd')` для текущей даты — результат зависит от TZ браузера. Для вычисления дат на основе "сегодня" — только `formatDateMoscow()` из utils.ts
43. **Purchase оси дат (миграция 020):** RPC `get_dashboard_summary` = order-based purchase для ВСЕХ МП (`purchase_price × sales_count` из mp_sales). UE Python endpoint = settlement-based для Ozon (`purchase_price × settled_qty` из mp_costs). Ключевой принцип: revenue и purchase ВСЕГДА на одной оси (RPC: обе order-based, UE: обе settlement-based из costs-tree). `mp_costs.settled_qty` НЕ удалять — используется в UE. Миграции: 019 (добавила settled_qty), 020 (откатила RPC на order-based). НИКОГДА не смешивать оси: order-based revenue + settlement-based purchase = profit > revenue (абсурд)
44. **Ozon реклама — DELETE before INSERT:** `mp_ad_costs` для Ozon имеет `product_id=NULL` (account-level). PostgreSQL: `NULL != NULL` в UNIQUE → UPSERT = INSERT дубликаты. Решение: DELETE за период перед INSERT в `sync_ads_ozon`. НЕ использовать UPSERT с NULL product_id для Ozon рекламы.
45. **Landing Hero:** текстовый hero БЕЗ скриншота (скрин перенесён в карусель). H1 = primary USP "Прозрачная аналитика для маркетплейсов". Badge = differentiator "WB + Ozon в одном дашборде". Подзаголовок = secondary USP "Собери свой дашборд из виджетов". CTA + trust text inline (одна строка). Скриншот продукта ТОЛЬКО в DashboardCarousel (3 слайда: Дашборд, UE, Остатки). НЕ добавлять скриншот в hero
46. **Landing NavBar:** sticky + backdrop-blur при скролле (classList.toggle, НЕ useState). Кликабельный логотип (scroll-to-top). `NAV_ITEMS` const. Clean gaps (hover:bg-gray-50, НЕ box-shadow). Hamburger 44px touch target. ARIA aria-expanded
47. **ProductShowcase:** pill badge "Ключевые экраны" (bg-indigo-50). Gradient title (indigo→violet). Tab progress bar h-[3px] gradient (НЕ h-0.5 solid). Active tab: ring-1 + shadow-indigo + icon text-indigo-600. BrowserFrame: ring-1 ring-gray-900/[0.07] + shadow-[0_8px_60px]. CTA "Попробовать бесплатно →" (text link, НЕ button). Device toggle скрывает текст Desktop/Mobile на мобилке (hidden sm:inline)
48. **Landing mobile overflow:** Root wrapper LandingPage ОБЯЗАН иметь `overflow-x-hidden`. Showcase container — `overflow-hidden`. Blur orbs: `w-full max-w-[Npx]` (НИКОГДА fixed `w-[600px]`). Negative inset на мобилке: `-inset-4` (НЕ `-inset-10`), desktop `sm:-inset-12`

## Формулы (КРИТИЧНО)
```
profit = total_payout - purchase - ads  (БЕЗ costsTreeRatio — удалён 19.02.2026, индустриальный стандарт)
COGS (RPC/Dashboard) = purchase_price × sales_count (order-based, из mp_sales — ВСЕ МП, миграция 020)
COGS (UE/Python)     = purchase_price × settled_qty (settlement-based, Ozon) | × sales_count (WB)
displayed_revenue = costs_tree_sales + credits (СПП, возмещения)
UE: profit_i = total_payout × (revenue_i / Σrevenue) - purchase_i - ad_i
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
Pace: pace_daily = actual / days_elapsed; required_pace = (plan - actual) / days_remaining
Forecast: forecast_revenue = actual + pace_daily × days_remaining; forecast_percent = forecast / plan × 100
FT breakdown: ft_payout = total_payout × (ft_rev / total_mp_sales_rev); ft_profit = ft_payout - ft_purchase - ft_ad
FT ad distribution: ad_ft = ad_product × (ft_rev / product_rev) — реклама account-level, делится пропорционально
FT proportion bar: pct = ft_rev / (fbo_rev + fbs_rev) × 100% — гарантия FBO% + FBS% = 100%
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

## Agent Pipeline (ОБЯЗАТЕЛЬНО для средних и больших задач)

Проект имеет систему кастомных агентов в `.claude/agents/`. **Ты (главный агент) = Tech Director.** Для задач, затрагивающих 3+ файлов или требующих UI-дизайна — **ОБЯЗАТЕЛЬНО** делегируй работу агентам через `Task` tool.

### Доступные агенты
| Агент | subagent_type | Роль | Когда использовать |
|-------|---------------|------|--------------------|
| `team-lead` | `team-lead` | Оркестратор pipeline | Большие фичи (8+ файлов), full-stack задачи |
| `investigator` | `investigator` | Находит ВСЕ связанные файлы | Перед любой задачей средней+ сложности |
| `designer` | `designer` | UI/UX spec: ASCII mockups, Tailwind классы | Новые UI компоненты, редизайн |
| `frontend-worker` | `frontend-worker` | Реализация React/TS | Фронтенд-код |
| `backend-worker` | `general-purpose` | Реализация Python/FastAPI | Backend-код, миграции, sync |
| `reviewer` | `reviewer` | Код-ревью: security, architecture, types | После реализации средних+ задач |
| `ui-reviewer` | `ui-reviewer` | Визуальный ревью: responsive, a11y | После UI-изменений |
| `debugger` | `debugger` | Диагностика и фикс багов | Когда что-то сломалось |

### Pipeline файлы (контекст между агентами)
```
.claude/pipeline/
  investigation.md ← investigator пишет, все читают
  design.md        ← designer пишет, workers + ui-reviewer читают
  plan.md          ← team-lead пишет, tech director читает
  review.md        ← reviewer/ui-reviewer пишут
```

### Когда какой подход
| Сложность | Файлов | Подход |
|-----------|--------|--------|
| **Мелкая** (баг, 1 файл) | 1-2 | Делай сам, без агентов |
| **Средняя** (фича, компонент) | 3-8 | team-lead оркестрирует pipeline |
| **Большая** (новая страница, full-stack) | 8+ | team-lead оркестрирует полный pipeline |

> **Правило:** Main агент НИКОГДА не читает pipeline файлы (investigation.md, design.md, plan.md). Только team-lead читает их в своём контексте. Main получает только финальный отчёт.

### Как запускать агентов
```
Task(subagent_type="team-lead", mode="bypassPermissions", prompt="[задача]")
Task(subagent_type="investigator", mode="bypassPermissions", prompt="Исследуй [фичу]. Запиши отчёт в investigation.md")
Task(subagent_type="frontend-worker", mode="bypassPermissions", prompt="Прочитай investigation.md. Реализуй [задачу].")
```

**КРИТИЧНО:** Всегда используй `mode="bypassPermissions"` при запуске агентов — иначе агент будет спрашивать разрешение на каждое действие.

### Правила делегирования
1. **НЕ делай сам** то, что должен делать агент — если задача средняя+, запусти pipeline
2. **НЕ пиши код сам** при наличии team-lead — дай ему координировать
3. **ВСЕГДА** включай в промпт агента: путь к pipeline файлам, конкретные файлы и строки кода
4. **Деплой — ТОЛЬКО пользователь** (через /deploy), агенты НЕ деплоят

## Документация
| Файл | Содержимое |
|------|-----------|
| [docs/README.md](docs/README.md) | Оглавление всей документации |
| [docs/architecture.md](docs/architecture.md) | Архитектура, 31 правило, data flow |
| [docs/api-reference.md](docs/api-reference.md) | 47 API endpoints |
| [docs/frontend-guide.md](docs/frontend-guide.md) | Компоненты, hooks, stores, routing |
| [docs/database.md](docs/database.md) | 15 таблиц, 4 RPC, 18 миграций |
| [docs/business-logic.md](docs/business-logic.md) | Формулы и методология |
| [docs/deployment.md](docs/deployment.md) | VPS, Nginx, деплой, troubleshooting |
| [docs/auth-security.md](docs/auth-security.md) | Auth, подписки, шифрование, CJM |
| [docs/sync-pipeline.md](docs/sync-pipeline.md) | WB/Ozon sync pipeline |
| [docs/development.md](docs/development.md) | Локальная разработка, стандарты кода |
| [docs/changelog.md](docs/changelog.md) | История версий |
| [docs/phases-history.md](docs/phases-history.md) | Архив истории фаз |
| [.claude/rules/coding-standards.md](.claude/rules/coding-standards.md) | Стандарты кода (React, FastAPI, Tailwind) |
