# Бриф: Интерактивный дашборд аналитики Wildberries & Ozon

## Дата создания: 22 января 2026
## Последнее обновление: 23 января 2026

---

## 1. Цель проекта

Интерактивный дашборд для мониторинга продаж, unit-экономики, удержаний маркетплейсов и рекламных расходов по **Wildberries** и **Ozon**.

---

## 2. Ассортимент товаров (5 SKU)

| Штрихкод (ШК) | Номенклатура | Закупка | WB nmID | Ozon product_id |
|---------------|--------------|---------|---------|-----------------|
| 4670157464824 | Магний + В6 хелат 800 мг | 280₽ | 254327396 | 1144779512 |
| 4670157464831 | Магний цитрат 800 мг | 250₽ | 254299021 | 1144795275 |
| 4670157464848 | L-карнитин 720 мг | 360₽ | 254278127 | 1145915272 |
| 4670157464770 | Витамин D3 + К2 260 мг | 280₽ | 254281289 | 1145845755 |
| 4670227414995 | Тестобустер | 404₽ | 260909523 | 1183426642 |

> Штрихкод (barcode) — универсальный идентификатор для связи товаров между МП. На Ozon `offer_id` = barcode.

---

## 3. Технический стек

### Backend
- **Python 3.14** + **FastAPI**
- **Supabase (PostgreSQL)** — БД + RLS
- **httpx** — асинхронные HTTP запросы к API МП
- **Pydantic** — валидация данных

### Frontend
- **React 19.2** + **TypeScript 5.9** + **Vite 7.2**
- **Tailwind CSS 3** — стилизация
- **Recharts** — графики
- **React Query 5.90** + **Zustand 5.0** — state management
- **lucide-react** — иконки
- **date-fns** — работа с датами

### Инфраструктура
- **Supabase** — hosted PostgreSQL + Auth + RLS
- **Деплой:** Beget + Supabase (планируется)
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

---

## 4. Интеграции с API

### Wildberries
| API | Эндпоинт | Назначение |
|-----|----------|------------|
| Content | `/content/v2/get/cards/list` | Карточки товаров |
| Statistics | `/api/v1/supplier/sales,orders,stocks` | Продажи, заказы, остатки |
| Analytics | `/api/v2/nm-report/detail` | Воронка продаж |
| Ads | `/adv/v1/promotion/count`, `/adv/v2/fullstats` | Реклама |
| Finance | `/api/v5/supplier/reportDetailByPeriod` | Удержания, комиссии |

### Ozon
| API | Эндпоинт | Назначение |
|-----|----------|------------|
| Seller | `/v3/product/list`, `/v3/product/info/list` | Товары |
| Stocks | `/v4/product/info/stocks` | Остатки |
| Finance | `/v3/finance/transaction/list` | Транзакции, удержания |
| Analytics | `/v1/analytics/data` | Продажи (dimensions=["sku","day"]) |
| Performance | OAuth 2.0 → campaigns, statistics | Реклама |

---

## 5. Ключевые метрики

### Продажи
- Заказы, выкупы, возвраты
- Процент возвратов: `returns / (sales + returns) * 100%`
- Средний чек
- Выручка по дням/товарам/МП

### Удержания МП (детализация 1-в-1 как в ЛК Ozon)
- **Вознаграждение МП** (комиссия) — с разбивкой по ставкам товаров
- **Услуги доставки** (логистика)
- **Услуги агентов** (эквайринг, звёздные товары, доставка до места выдачи)
- **Услуги FBO** (складские услуги, хранение)
- **Продвижение и реклама** (бонусы продавца)
- **Штрафы**

### Unit-экономика
```
Выручка
- Закупочная цена
- Комиссия МП
- Логистика
- Хранение
- Эквайринг
- Штрафы
- Продвижение
─────────────────
= Чистая прибыль
```

### Реклама
- Показы, клики, расход
- CTR, CPC, ACOS
- ДРР (доля рекламных расходов)

---

## 6. Структура проекта

```
Analitics/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── products.py        # Товары
│   │   │   ├── dashboard.py       # Аналитика (summary, sales-chart, costs-tree, stocks, unit-economics, ad-costs)
│   │   │   └── sync.py            # Синхронизация (products, sales, stocks, costs, ads, all)
│   │   ├── services/
│   │   │   ├── wb_client.py       # WB API клиент
│   │   │   ├── ozon_client.py     # Ozon Seller + Performance клиенты
│   │   │   └── sync_service.py    # Сервис синхронизации
│   │   ├── db/supabase.py         # Подключение к Supabase
│   │   ├── config.py              # Конфигурация
│   │   └── main.py                # FastAPI app
│   ├── migrations/
│   │   ├── 001_initial.sql        # Основные таблицы
│   │   └── 002_costs_details.sql  # Детализация удержаний
│   ├── requirements.txt
│   ├── test_api.py
│   └── test_sync.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/         # SummaryCard, MarketplaceBreakdown, CostsTreeView
│   │   │   └── Shared/            # LoadingSpinner, FilterPanel
│   │   ├── hooks/                 # useDashboard, useSync
│   │   ├── pages/                 # Dashboard, Products, UnitEconomics, Ads, Sync
│   │   ├── services/api.ts        # Axios клиент
│   │   ├── store/                 # Zustand
│   │   ├── types/index.ts         # TypeScript типы
│   │   └── lib/utils.ts           # Утилиты форматирования
│   ├── package.json
│   └── tailwind.config.js
├── .env                            # API ключи (НЕ коммитить!)
├── BRIEF.md                        # Этот файл
├── CLAUDE.md                       # Контекст для AI-разработки
└── DECISIONS.md                    # Утверждённые архитектурные решения
```

---

## 7. База данных (Supabase PostgreSQL)

### Таблицы (префикс `mp_`)

| Таблица | Назначение | Unique constraint |
|---------|------------|-------------------|
| mp_products | Товары + ID маркетплейсов | barcode |
| mp_sales | Продажи (ежедневно) | (product_id, marketplace, date) |
| mp_stocks | Остатки | (product_id, marketplace, warehouse) |
| mp_costs | Удержания — агрегация (7 типов) | (product_id, marketplace, date) |
| mp_costs_details | Удержания — детализация (category/subcategory) | (product_id, marketplace, date, category, subcategory) |
| mp_ad_costs | Рекламные расходы | (product_id, marketplace, date, campaign_id) |
| mp_sales_geo | География продаж | (product_id, marketplace, date, region) |
| mp_sync_log | Логи синхронизации | — |

### Гибридный подход к удержаниям:
- **mp_costs** — быстрая агрегация для карточек/графиков (SUM по 7 полям)
- **mp_costs_details** — гранулярные данные для tree-view (category → subcategory → amount)

---

## 8. Текущее состояние (23.01.2026)

### Реализовано (MVP ✅)
- [x] API клиенты WB + Ozon (Seller + Performance)
- [x] Синхронизация: products, sales, stocks, costs, ads
- [x] Dashboard: summary, sales-chart, stocks, unit-economics, ad-costs
- [x] Frontend: 5 страниц (Dashboard, Products, UnitEconomics, Ads, Sync)
- [x] Фильтры: период (7/30/90d), маркетплейс, товар
- [x] Orphan-costs фильтрация
- [x] Ozon sync по дням (dimensions=["sku","day"])

### В разработке
- [x] mp_costs_details таблица + миграция
- [x] Endpoint GET /dashboard/costs-tree
- [x] sync_costs_ozon() → сохранение category/subcategory
- [x] WB costs детализация (mp_costs_details) + системный товар WB_ACCOUNT для строк без товара
- [x] Reconcile-инструменты: `ozon/reconcile_accruals.py` и `wb/reconcile_wb.py`
- [x] Frontend: карточки начислений (Ozon/WB) + детализация деревом

### Планируется
- [ ] Доработки визуала/UX tree (1-в-1 с ЛК, если потребуется)
- [ ] Custom Date Picker (произвольный период)
- [ ] Excel export
- [ ] Автообновление (React Query refetchInterval)

### Данные

| Источник | Записи | Примечание |
|----------|--------|------------|
| WB продажи | ~51 | 35 дней, по дням |
| Ozon продажи | 43 | 35 дней, по дням |
| WB costs | ~46 | комиссия 518₽, логистика 1,376₽, эквайринг 337₽ |
| Ozon costs | 0 | finance API не возвращает транзакций |
| WB реклама | 1 | 0.18₽, кампания неактивна |
| Ozon реклама | 0 | нет активных кампаний |

---

## 9. Дизайн

- **Стиль:** Stripe Dashboard (минималистичный)
- **Цвета МП:** WB `#8B3FFD` (фиолетовый), Ozon `#005BFF` (синий)
- **Шрифт:** Inter (system)
- **Иконки:** lucide-react
- **Компоненты:** карточки метрик, графики Recharts, expandable таблицы, tree-view

---

## 10. Частота синхронизации

| Данные | Частота | Реализация |
|--------|---------|------------|
| Остатки | каждый час | по кнопке (MVP) |
| Продажи | каждые 2 часа | по кнопке (MVP) |
| Удержания | раз в день | по кнопке (MVP) |
| Реклама | раз в день | по кнопке (MVP) |

> v2.0: автообновление через React Query refetchInterval / APScheduler

---

## 11. Документация

- [backend/README.md](backend/README.md) — API endpoints, схема БД, архитектура
- [frontend/README.md](frontend/README.md) — компоненты, hooks, типы
- [frontend/DESIGN_REFERENCE.md](frontend/DESIGN_REFERENCE.md) — гайд по дизайну
- [DECISIONS.md](DECISIONS.md) — утверждённые решения
- [CLAUDE.md](CLAUDE.md) — контекст для AI-разработки

---

*Документ создан: 22.01.2026*
*Последнее обновление: 23.01.2026*
