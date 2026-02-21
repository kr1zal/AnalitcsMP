# Техническая документация блоков

> Полная трассировка каждого визуального блока: UI → Hook → API → Backend → RPC → DB.
> Используется для диагностики, создания skills/agents и онбординга.

## Навигация

### Dashboard (`/`)

| # | Блок | Файл | Описание |
|---|------|------|----------|
| 01 | FilterPanel | [dashboard/01-filter-panel.md](dashboard/01-filter-panel.md) | Sticky фильтры: период, МП, FBO/FBS, URL sync |
| 02 | Metric Cards | [dashboard/02-metric-cards.md](dashboard/02-metric-cards.md) | 8 карточек 4x2: Заказы, Выкупы, Себестоимость, Прибыль, Удержания, Реклама, Выплата, Δ |
| 03 | Plan Completion | [dashboard/03-plan-completion.md](dashboard/03-plan-completion.md) | Карточка выполнения плана продаж (Pro+) |
| 04 | MP Breakdown | [dashboard/04-marketplace-breakdown.md](dashboard/04-marketplace-breakdown.md) | Карточки OZON + WB: costs-tree, начисления, прибыль |
| 05 | Charts | [dashboard/05-charts.md](dashboard/05-charts.md) | Графики: продажи, прибыль, ДРР, конверсия + sidebar товаров |
| 06 | Analytics | [dashboard/06-analytics-widgets.md](dashboard/06-analytics-widgets.md) | Waterfall, Donut, TopProducts, StockForecast |
| 07 | Stock History | [dashboard/07-stock-history.md](dashboard/07-stock-history.md) | Динамика остатков (line chart, self-contained) |
| 08 | Stocks Table | [dashboard/08-stocks-table.md](dashboard/08-stocks-table.md) | Таблица остатков: search, sort, pagination, expand |

### Unit Economics (`/unit-economics`)

| # | Блок | Файл | Описание |
|---|------|------|----------|
| 01 | Overview | [unit-economics/01-overview.md](unit-economics/01-overview.md) | KPI cards + PlanMatrix |
| 02 | Profit Bars | [unit-economics/02-profit-bars.md](unit-economics/02-profit-bars.md) | ProfitBars + CostStructure + ABC |
| 03 | Table | [unit-economics/03-table.md](unit-economics/03-table.md) | UeTable + FBO/FBS breakdown |

### Order Monitor (`/orders`)

| # | Блок | Файл | Описание |
|---|------|------|----------|
| 01 | Monitor | [orders/01-order-monitor.md](orders/01-order-monitor.md) | Funnel + OrdersList + OrderDetail |

### Ads (`/ads`)

| # | Блок | Файл | Описание |
|---|------|------|----------|
| 01 | Overview | [ads/01-overview.md](ads/01-overview.md) | KPI cards + charts |
| 02 | Tables | [ads/02-tables.md](ads/02-tables.md) | CampaignTable + DailyTable |

### Settings (`/settings`)

| # | Блок | Файл | Описание |
|---|------|------|----------|
| 01 | Connections | [settings/01-connections.md](settings/01-connections.md) | API-токены + SyncingOverlay |
| 02 | Products | [settings/02-products.md](settings/02-products.md) | Управление товарами (drag&drop, groups) |
| 03 | Plan Editor | [settings/03-plan-editor.md](settings/03-plan-editor.md) | Редактор плана продаж |
| 04 | Billing | [settings/04-billing-profile.md](settings/04-billing-profile.md) | Подписки + YooKassa + профиль |

### Shared (cross-page)

| # | Блок | Файл | Описание |
|---|------|------|----------|
| 01 | Layout | [shared/01-layout.md](shared/01-layout.md) | Layout + nav + ProtectedRoute + FeatureGate |
| 02 | Data Layer | [shared/02-data-layer.md](shared/02-data-layer.md) | api.ts + interceptors + React Query |
| 03 | State | [shared/03-state-management.md](shared/03-state-management.md) | useFiltersStore + URL sync |

## Как использовать

### Диагностика бага
1. Определи какой блок показывает неверные данные
2. Открой документ блока → секция "Data Flow"
3. Трассируй от UI до DB: на каком шаге данные расходятся?
4. Секция "Формулы" — проверь корректность вычислений
5. Секция "Edge Cases" — известная ли это проблема?

### Добавление нового блока
1. Скопируй [_template.md](_template.md)
2. Заполни все секции
3. Добавь в эту таблицу

### Создание Skill/Agent
Блочные документы содержат точные пути файлов, номера строк и формулы — agent может читать конкретный документ и точно знать где искать проблему.
