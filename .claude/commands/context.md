Загрузи полный контекст проекта Analytics Dashboard для продуктивной работы.

Выполни ВСЕ шаги параллельно, затем выдай краткий отчёт.

## Шаг 1: Прочитай ключевые файлы (параллельно)
- `CLAUDE.md` — архитектура, решения, стек, БД, роудмап
- `memory/MEMORY.md` — накопленные знания и решения
- `CHANGELOG.md` (последние 100 строк) — недавние изменения
- `backend/app/api/v1/dashboard.py` — главный endpoint (формулы прибыли, UE, СПП)
- `frontend/src/pages/DashboardPage.tsx` — главная страница (costsTreeRatio, credits)
- `frontend/src/types/index.ts` — все TypeScript типы

## Шаг 2: Проверь текущее состояние (параллельно)
- `git status` — незакоммиченные изменения
- `git log --oneline -10` — последние коммиты
- `lsof -i :8000` и `lsof -i :5173` — работают ли backend/frontend
- Проверь production: `curl -s -o /dev/null -w "%{http_code}" https://reviomp.ru`

## Шаг 3: Выдай краткий отчёт

Формат:
```
=== ANALYTICS DASHBOARD — КОНТЕКСТ ===

📊 Статус: [что задеплоено, что в работе]
🔧 Локально: backend [up/down], frontend [up/down]
🌐 Production: [статус reviomp.ru]
📝 Незакоммичено: [список файлов или "чисто"]
🔄 Последний коммит: [hash + message]

⚠️ Ключевые правила:
- НИКОГДА npm run dev — только npm run build для проверки
- Costs-tree: отдельные запросы per marketplace
- UE Profit: payout × (revenue_i / Σrevenue) — НЕ revenue - costs
- costsTreeRatio = pure_sales / mp_sales (БЕЗ credits/СПП)
- СПП входит в "Продажи" (displayed_revenue = sales + credits)
- Tailwind v3, НЕ v4
- Деплой только по команде /deploy
```

## Критические формулы (запомни!)

### Dashboard Profit
```
profit = total_payout - purchase_adjusted - ads_adjusted
purchase_adjusted = purchase × costsTreeRatio
costsTreeRatio = costs_tree_SALES / mp_sales_revenue (без credits!)
```

### UE Profit (per product)
```
profit_i = total_payout × (revenue_i / Σrevenue) - purchase_i×ratio - ad_i×ratio
Гарантия: ΣUE_profit = Dashboard_profit
```

### СПП в Продажах (WB)
```
displayed_revenue = costs_tree_sales + costs_tree_credits
credits = tree items where amount > 0 AND name ≠ "Продажи" (СПП, возмещения)
costsTreeRatio uses PURE sales (without credits) — для корректной коррекции закупки
```

### Stock Forecast
```
days_remaining = total_quantity / avg_daily_sales(30d)
Цвета: red ≤7д, yellow ≤14д, blue ≤30д, green >30д
```

## Архитектура (НЕ МЕНЯТЬ — 19 решений)
1. Costs-tree: параллельные запросы per marketplace
2. AccrualsCards: данные через props
3. DateRangePicker: captionLayout="label"
4. Tailwind v3
5. PDF: Playwright backend
6. Auth: Hybrid (service_role + RLS + JWKS)
7. Шифрование: Fernet backend
8. Hero: Canvas MatrixRain
9. Guide lines: left-12/right-12 (48px)
10. Pricing: grid-cols-2 always
11. PRO block: SHOW_PRO = false
12. Product Management: 3-col, @dnd-kit, click modals
13. UE Profit: payout distribution (НЕ revenue - costs)
14. СПП: credits INCLUDED в displayed_revenue
15. DataFlow: V3 only (V1/V2 удалены)
16. Landing: все секции в LandingPage.tsx
17. WB SPP: sale_price = retail_price_withdisc_rub
18. Sync: DB queue + cron (НЕ Celery)
19. costsTreeRatio: pure sales / mp_sales (БЕЗ credits)

## Ключевые файлы
| Файл | Что в нём |
|------|-----------|
| `backend/app/api/v1/dashboard.py` | Все dashboard endpoints: summary, costs-tree, UE, stocks, orders |
| `backend/app/api/v1/products.py` | CRUD товаров, link/unlink, reorder |
| `backend/app/api/v1/sync.py` | Ручная/авто синхронизация |
| `backend/app/api/v1/tokens.py` | Onboarding: сохранение API-токенов |
| `backend/app/api/v1/subscription.py` | YooKassa, upgrade/cancel/webhook |
| `backend/app/services/sync_service.py` | WB/Ozon sync logic |
| `frontend/src/pages/DashboardPage.tsx` | Главная: плашки + карточки МП |
| `frontend/src/pages/UnitEconomicsPage.tsx` | UE таблица + структура |
| `frontend/src/pages/LandingPage.tsx` | Landing (~2000 строк) |
| `frontend/src/components/Settings/ProductManagement.tsx` | Drag&drop товары |
| `frontend/src/services/api.ts` | Axios + auth + все API вызовы |
| `frontend/src/types/index.ts` | Все TypeScript типы |

## Товары (5 SKU + system)
| Штрихкод | Название | WB nmID | Ozon product_id |
|----------|----------|---------|-----------------|
| 4670157464824 | Магний + В6 хелат | 254327396 | 1144779512 |
| 4670157464831 | Магний цитрат | 254299021 | 1144795275 |
| 4670157464848 | L-карнитин | 254278127 | 1145915272 |
| 4670157464770 | Витамин D3 + К2 | 254281289 | 1145845755 |
| 4670227414995 | Тестобустер | 260909523 | 1183426642 |
| — | WB_ACCOUNT (system) | — | — |

## DB таблицы (все mp_*, все с user_id + RLS)
mp_products, mp_sales, mp_stocks, mp_costs, mp_costs_details, mp_sales_geo,
mp_ad_costs, mp_sync_log, mp_user_tokens, mp_user_subscriptions, mp_sync_queue, mp_orders

ВАЖНО: Отвечай на русском. Не запускай npm run dev. Не деплой без команды /deploy.
