# АУДИТ OZON DATA PIPELINE — 20.02.2026

## СТАТУС: ✅ ВСЕ АГЕНТЫ ЗАВЕРШЕНЫ. Готово к реализации.

## ИССЛЕДОВАНИЕ ЛИДЕРОВ РЫНКА (завершено)

| Сервис | Подход | Себестоимость | Точность удержаний |
|--------|--------|---------------|-------------------|
| **SellerBoard** | order↔settlement связка, 3 режима дат | Привязана к заказу | Точная (Finance API) |
| **MPStats** | По дате заказа, оценочные комиссии | По заказам | ~90% (формулы) |
| **Moneyplace** | По дате заказа, оценочные комиссии | По заказам | ~90% |
| **MarketDB** | По дате расчёта, qty из финотчёта | По settled qty | Точная |
| **Ozon ЛК** | Раздельные экраны (аналитика ≠ финансы) | Не считает | Точная |
| **Наш проект** | СМЕШАННЫЙ (costs-tree расчёт + mp_sales заказы) | По заказам (БАГ!) | Точная |

### Рекомендуемый подход: Вариант B (settlement-centric) + UI пояснения
1. Считать `settled_sales_count` из mp_costs_details (а не из mp_sales)
2. `purchase = purchase_price × settled_sales_count`
3. `profit = total_payout - purchase - ads` (всё по settlement date)
4. Тултип на UI: "Прибыль по финансовым расчётам МП за период"
5. Карточки "Заказы" оставить по mp_sales (операционная метрика)

### Долгосрочно (Phase 2): SellerBoard-подход
- Связка order↔settlement через posting_number (уже есть в Ozon Finance API)
- Переключение режимов: "по дате заказа" / "по дате расчёта"

## P&L BEST PRACTICES (исследование завершено)

**Индустриальный стандарт: Settlement-based P&L** (как Amazon Seller Central, Jungle Scout)
- Order-date метрики (заказы, выкупы) — операционные, для маркетологов
- Settlement-date метрики (выручка, прибыль) — финансовые, для P&L
- **Наш подход settlement-based = ПРАВИЛЬНЫЙ**, совпадает с ЛК (diff=0.00₽)
- **НО purchase должен быть тоже settlement-based** — это единственный баг

### UX-улучшения (без изменения подхода):
1. Tooltip на карточке "Прибыль": "По финансовому расчёту МП (1-3 недели после продажи)"
2. Data freshness badge: "Финотчёт до: DD.MM"
3. Help-блок: почему цифры могут отличаться от ожидаемых
4. Toggle "по заказам/расчётам" — только для Enterprise (Phase 2, 40ч+)

### Отраслевые аналоги:
| Продукт | Подход |
|---------|--------|
| Amazon Seller Central | Settlement-based P&L |
| SellerBoard | Hybrid (order↔settlement matching) |
| Jungle Scout | Settlement-based |
| Helium 10 | Toggle (order/payment date) |
| MPStats/Moneyplace | Order-based (оценочные комиссии) |

---

## КОРНЕВАЯ ПРОБЛЕМА: Смешение осей дат

Dashboard смешивает ДВЕ временные оси:
- **mp_sales** (Analytics API) → дата ЗАКАЗА
- **costs-tree** (Finance API) → дата РАСЧЁТА (settlement)

Ozon рассчитывается с продавцом через 1-3 недели после заказа.

### Пример (12-17 фев, Ozon FBO):
```
Заказы (mp_sales):     3 шт,   1,817₽  (по дате заказа)
Выручка (costs-tree):           8,247₽  (по дате расчёта — ЗА СТАРЫЕ заказы)
Себестоимость:         3 шт,   1,124₽  (по дате заказа, 3 новых товара)
Payout:                         4,362₽  (по дате расчёта)
Profit:                         3,238₽  = payout(4362) - purchase(1124)
```

**Абсурд:** profit 3,238₽ > revenue заказов 1,817₽. Прибыль БОЛЬШЕ выручки заказов.
**Причина:** вычитаем закупку 3 НОВЫХ товаров из выплаты за ~10 СТАРЫХ товаров.

---

## ВСЕ НАЙДЕННЫЕ ПРОБЛЕМЫ (18 штук)

### P0 — CRITICAL

#### 1. Смешение осей дат (заказ vs расчёт) — ГЛАВНЫЙ БАГ
- **Файлы:** DashboardPage.tsx, dashboard.py
- **Суть:** Revenue/profit из costs-tree (settlement date), purchase из mp_sales (order date)
- **Импакт:** Все карточки дашборда для Ozon показывают некорректную прибыль
- **Данные:** За 12-17 фев profit=+3238₽ (фейк), реальность — нужно считать по одной оси

#### 2. Дупликация рекламных расходов Ozon при каждом sync
- **Файлы:** sync_service.py:2182, mp_ad_costs UNIQUE constraint
- **Суть:** product_id=None для Ozon ads. UNIQUE с NULL не работает в PostgreSQL (NULL!=NULL)
- **Импакт:** ad_cost растёт с каждой синхронизацией
- **Фикс:** DELETE перед INSERT (как в mp_costs_details)

#### 3. Summary net_profit vs costs-tree profit расхождение
- **20d:** Summary=-1,305₽ vs CT=-9,382₽ (Δ=8,076₽)
- **7d:** Summary=+924₽ vs CT=-1,187₽ (Δ=2,111₽)
- **Причина:** Summary использует mp_sales.revenue (все заказы), CT — settled only

#### 4. FBS-фильтр для Ozon показывает пустые данные
- **Суть:** sync_sales_ozon ВСЕГДА ставит fulfillment_type='FBO'
- **Импакт:** При фильтре FBS все Ozon данные = 0 (кроме costs-tree)

### P1 — HIGH

#### 5. costs_breakdown всегда нули
- total_costs=7,777₽ но breakdown={commission:0, logistics:0, ...} для ВСЕХ МП

#### 6. Двойной учёт рекламы при FBO+FBS раздельном анализе
- mp_ad_costs не фильтруется по fulfillment_type

#### 7. Excel export использует WB-категории для Ozon
- Файл: exportExcel.ts:103-130
- "Комиссия","Логистика" (WB) вместо "Вознаграждение Ozon","Услуги доставки"

#### 8. FBO breakdown revenue vs metrics revenue несогласованность
- metrics.revenue (costs-tree) vs fbo.revenue (mp_sales) — разные числа
- margin считается по mp_sales revenue, profit по costs-tree

#### 9. 30-дневный лимит Finance API
- sync_costs_ozon обрезает период до 30д, старые данные теряются

### P2 — MEDIUM

#### 10. mp_costs_details без UNIQUE constraint (дупликация при сбое)
#### 11. VITAMIN_SKUS захардкожены (не SaaS-ready)
#### 12. sync_sales_ozon без пагинации (limit:1000 без offset)
#### 13. mp_orders: logistics и storage_fee = 0 для Ozon
#### 14. Ozon ads product_id=None — кампании без привязки к товарам

### P3 — LOW
#### 15. Отсутствующие индексы для multi-tenant
#### 16. Неиспользуемые поля Ozon API (session_view, delivered_units, city)
#### 17. OAuth2 token refresh для Performance API
#### 18. Fragile getSalesTotalFromCostsTree (не различает WB/Ozon)

---

## LIVE-СВЕРКА ДАННЫХ (Production)

### 20d (Feb 01-20, ozon):
```
                    Summary     Costs-tree   Δ
Revenue:            24,252      17,195       7,057 (29% непроведённых)
Costs/Deductions:    7,777       8,797       1,020
Payout:             16,475       8,398       8,076
NET PROFIT:         -1,305      -9,382       8,076
Sales count:            51          51       0 ✓
UE Σ profits:           --      -9,382       0.01 (rounding) ✓
```

### 7d (Feb 14-20, ozon):
```
Summary profit: +924₽ | CT profit: -1,187₽ | Δ: 2,111₽
```

### 6d custom (Feb 12-17, ozon FBO) — СКРИНШОТ ПОЛЬЗОВАТЕЛЯ:
```
Orders (mp_sales): 3 шт, 1,817₽
Revenue (CT):      8,247₽
Purchase:          1,124₽ (3 шт по дате заказа)
Payout:            4,362₽
Deductions:        3,885₽
Profit:            3,238₽ ← ФЕЙКОВЫЙ (purchase от других заказов)
```

### ALL = WB + OZON: ✅ (48,886 = 24,634 + 24,252)
### FBO = ALL для Ozon: ✅ (FBS = пустой)
### UE Σ = CT profit: ✅ (Δ = 0.01₽ rounding)

---

## МАТРИЦА ИСТОЧНИКОВ ДАННЫХ OZON

| Данные | API | Дата | FBO/FBS | Проблемы |
|--------|-----|------|---------|----------|
| Sales (count, revenue) | Analytics /v1/analytics | Заказа | ВСЕГДА FBO | Rev ≠ финотчёт |
| Costs-tree (deductions, payout) | Finance /v3/finance | Расчёта | ✅ FBO+FBS | Лимит 30д |
| Orders (per-order) | Postings /v3/fbs + /v2/fbo | Заказа | ✅ FBO+FBS | logistics=0 |
| Stocks | /v4/stocks | Текущие | ~FBO+FBS | Fallback→FBO |
| Ads | Performance OAuth2 | Дневная | Нет (account) | product_id=null, дупликация |

---

## РЕКОМЕНДАЦИИ

### Немедленно:
1. Фикс дупликации mp_ad_costs (DELETE before INSERT для Ozon)
2. Проверить данные: `SELECT count(*), date, campaign_id FROM mp_ad_costs WHERE marketplace='ozon' GROUP BY date, campaign_id HAVING count(*) > 1`

### После исследования агентов:
3. Выбрать подход к выравниванию дат (order-date vs settlement-date P&L)
4. Реализовать выбранный подход

### Backlog:
5-18. См. список P1-P3 выше

---

## OZON API: СВЯЗКА ЗАКАЗ↔РАСЧЁТ (исследование завершено)

**КЛЮЧЕВАЯ НАХОДКА:** `/v3/finance/transaction/list` УЖЕ содержит ОБЕ ДАТЫ!

### Реальный ответ API (проверено на production):
```json
{
  "operation_id": 45656238598,
  "operation_type": "OperationAgentDeliveredToCustomer",
  "operation_date": "2026-02-15 00:00:00",        // ← ДАТА РАСЧЁТА (settlement)
  "accruals_for_sale": 320,
  "sale_commission": -108.8,
  "amount": 162.14,
  "posting": {
    "delivery_schema": "FBO",
    "order_date": "2026-02-06 04:49:33",           // ← ДАТА ЗАКАЗА
    "posting_number": "04048979-0139-1",            // ← СВЯЗКА с postings
    "warehouse_id": 23948599159000
  },
  "items": [{ "name": "Л Карнитин...", "sku": 1659298299 }],
  "services": [
    { "name": "MarketplaceServiceItemRedistributionLastMileCourier", "price": -2.29 },
    { "name": "MarketplaceServiceItemDirectFlowLogistic", "price": -46.77 }
  ]
}
```

### Доступные поля для settlement-based P&L:
| Поле | Описание | Наш код |
|------|----------|---------|
| `operation_date` | Дата расчёта (settlement) | ✅ Используется |
| `posting.order_date` | Дата заказа | ❌ ИГНОРИРУЕТСЯ |
| `posting.posting_number` | Номер отправления (связка) | ❌ НЕ СОХРАНЯЕТСЯ |
| `posting.delivery_schema` | FBO/FBS | ✅ Используется |
| `items[].sku` | SKU товара | ✅ Используется |
| `accruals_for_sale` | Выручка за единицу | ✅ Используется |
| `amount` | Итого к выплате | ✅ Используется |
| `services[]` | Детализация удержаний | ✅ Используется |

### Текущая проблема в коде:
```python
# sync_service.py:1814 — текущий код:
date = op.get("operation_date", "")[:10]   # settlement date ONLY
# posting.order_date — ПОЛНОСТЬЮ ИГНОРИРУЕТСЯ
```

### Вывод: НЕ НУЖЕН дополнительный API или JOIN!
- `/v3/finance/transaction/list` уже отдаёт `order_date` внутри каждой операции
- Нужно лишь начать его извлекать и сохранять
- `/v1/finance/realization` — НЕ РАБОТАЕТ (404), устаревший endpoint
- Postings API (`/v2/posting/fbo/list`) — `financial_data.payout = 0` пока заказ НЕ delivered

---

## ФИНАЛЬНЫЙ ПЛАН РЕАЛИЗАЦИИ

### Phase 1: Немедленные фиксы (2-3 часа)

#### 1a. Фикс дупликации mp_ad_costs Ozon
- `sync_service.py`: DELETE перед INSERT для Ozon ads (как mp_costs_details)
- Очистка дубликатов: `DELETE FROM mp_ad_costs WHERE id NOT IN (SELECT MIN(id) ... GROUP BY date, campaign_id, marketplace)`

#### 1b. Settlement-based purchase (ГЛАВНЫЙ фикс)
- **Вариант A (быстрый):** Считать `settled_sales_count` из `mp_costs_details` (подсчёт уникальных операций типа "orders" за период)
  - `purchase = purchase_price × settled_sales_count`
  - Всё на одной оси дат (settlement)
- **Вариант B (правильный):** Сохранять `posting.order_date` в mp_costs_details при sync
  - Новая колонка `order_date` в mp_costs_details
  - Группировка по order_date ИЛИ operation_date (toggle)
  - Позволяет оба режима в будущем

**Рекомендация: Вариант A сейчас + Вариант B в Phase 2**

### Phase 2: Полная интеграция дат (8-12 часов)
1. Миграция: `ALTER TABLE mp_costs_details ADD COLUMN order_date DATE`
2. `sync_costs_ozon`: извлекать и сохранять `posting.order_date`
3. `sync_costs_ozon`: сохранять `posting.posting_number` (для связки)
4. Backend: параметр `date_mode=settlement|order` в costs-tree RPC
5. Frontend: toggle или tooltip

### Phase 3: SellerBoard-подход (40+ часов)
1. Связка order↔settlement через posting_number
2. 3 режима дат: по заказу / по расчёту / гибрид
3. Реальный P&L с матчингом заказов и расчётов
