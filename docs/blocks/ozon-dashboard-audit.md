# Аудит блока Ozon на дашборде — Cross-Axis проблема

> Дата: 21.02.2026
> Статус: В обсуждении

## Проблема

Дашборд смешивает две оси дат для Ozon:
- **ORDER** (mp_sales) — дата размещения заказа
- **SETTLEMENT** (costs-tree / mp_costs_details) — дата финоперации (когда Ozon провёл расчёт)

На 1 день расхождение катастрофическое (×2), на 7д — заметное (10-30%), на 30д — умеренное.

### Пример: 15 февраля 2026

| Источник | Выручка | Кол-во | Товары |
|----------|---------|--------|--------|
| mp_sales (ORDER) | 863₽ | 1 шт | Тестобустер |
| costs-tree (SETTLEMENT) | 1 783₽ | 4 шт | L-карнитин (3), Витамин D3 (1) |

Карточка "Выкупы" показывает: **1 783₽, 1 шт** — абсурд.

## Затронутые блоки (6 из 16)

| Блок | Проблема | Критичность |
|------|----------|-------------|
| Карточка "Выкупы" | revenue=SETTLEMENT, count=ORDER | HIGH |
| Карточка "Чистая прибыль" | payout=SETTLEMENT − purchase=ORDER | CRITICAL |
| Карточка "Рентабельность/Δ" | Наследует от прибыли | MEDIUM |
| ProfitWaterfall | revenue=SETTLEMENT, purchase=ORDER | MEDIUM |
| ProfitChart | daily revenue=ORDER × margin=SETTLEMENT | LOW-MEDIUM |
| Per-MP profit (Breakdown) | payout=SETTLEMENT, purchase×share=ORDER×SETTLEMENT | MEDIUM |

## Чистые блоки (10 из 16)

Заказы, Себестоимость, Удержания МП, К перечислению, Реклама, SalesChart, ConversionChart, DrrChart, CostsDonut, Stocks

---

## Предложения аналитика

<!-- Предложения от агента-аналитика — 21.02.2026 -->

### Обзор вариантов

| # | Название | Суть | Сложность | Точность 1д / 7д / 30д |
|---|----------|------|-----------|------------------------|
| A | Settlement-first Dashboard | Все метрики на оси SETTLEMENT | ~12ч | 100% / 100% / 100% |
| B | Dual-axis с разделением | ORDER-блоки и SETTLEMENT-блоки раздельно | ~8ч | 95% / 98% / 99% |
| C | Ozon Revenue Reconciliation (posting-level) | Обогащение mp_sales settlement-данными через posting_number | ~16ч | 98% / 99% / 100% |
| D | Disclaimer + Period Smoothing (минимальные изменения) | Текущая логика + предупреждение + автоматическое расширение окна | ~4ч | 70% / 90% / 97% |

---

### Вариант A: Settlement-first Dashboard

**Суть:** Для Ozon ВСЕ метрики дашборда переводятся на ось SETTLEMENT — дату финансовой операции. Карточки "Выкупы", "Прибыль", Waterfall, ProfitChart — всё из `mp_costs` + `mp_costs_details`. Ось ORDER используется ТОЛЬКО для карточки "Заказы" и SalesChart.

**Формулы:**

```
# Карточка "Выкупы" (settlement-based для Ozon)
  WB:   revenue = costs_tree["Продажи"] + credits,  count = mp_sales.sales_count
  Ozon: revenue = costs_tree["Продажи"],             count = SUM(mp_costs.settled_qty)

# Карточка "Чистая прибыль"
  profit = total_payout - purchase - ads
  WB:   purchase = purchase_price * mp_sales.sales_count  (order-based, единая ось)
  Ozon: purchase = purchase_price * mp_costs.settled_qty  (settlement-based)
  -> Rule #43 соблюден: revenue и purchase на одной оси (SETTLEMENT)

# Рентабельность
  margin = profit / revenue * 100%
  revenue = costs_tree revenue (SETTLEMENT)

# ProfitWaterfall
  revenue       = costs_tree_sales + credits (SETTLEMENT)
  mpDeductions  = ABS(отрицательные tree items) (SETTLEMENT)
  purchase      = Ozon: settled_qty * CC, WB: sales_count * CC
  ads           = mp_ad_costs (account-level)
  profit        = total_payout - purchase - ads

# ProfitChart (daily)
  profitMargin = netProfit / revenue (period-level, SETTLEMENT)
  dailyRevenue = НЕТ daily costs-tree -> нужен новый источник
  АЛЬТЕРНАТИВА: dailyRevenue из mp_costs (settlement date),
                dailyProfit = dailyRevenue * profitMargin

# Per-MP profit (MarketplaceBreakdown)
  Ozon: profit = ozon_payout - (settled_qty * CC) - ad*share
  WB:   profit = wb_payout - (sales_count * CC) - ad*share
  share = pureSales_mp / totalPureSales (обе из costs-tree = SETTLEMENT)
```

**Что нужно в бэкенде:**

1. **Новый RPC `get_ozon_settlement_summary`** (или расширить `get_dashboard_summary`):
```sql
-- Ozon settlement-based summary
SELECT
  SUM(mc.settled_qty) as sales_count,
  SUM(mc.settlement_revenue) as revenue,  -- нужно добавить поле в mp_costs
  SUM(p.purchase_price * mc.settled_qty) as purchase
FROM mp_costs mc
JOIN mp_products p ON mc.product_id = p.id
WHERE mc.marketplace = 'ozon'
  AND mc.date BETWEEN p_date_from AND p_date_to
  AND mc.user_id = p_user_id;
```

2. **Новое поле `settlement_revenue` в `mp_costs`** — выручка от расчетных операций Ozon. Заполняется из `/v3/finance/transaction/list` по товарным операциям.

3. **Миграция 021:** `ALTER TABLE mp_costs ADD COLUMN settlement_revenue NUMERIC DEFAULT 0;`

4. **Изменения в `sync_costs_ozon`:** при записи `mp_costs` также сохранять `settlement_revenue`.

5. **Изменения в `dashboard.py`:** `get_summary` проверяет marketplace — для Ozon подставляет settlement-based данные.

**Что нужно на фронтенде:**

1. **`DashboardPage.tsx`:**
   - `salesCountForTile` — для Ozon из нового поля `settlement_sales_count` (или из UE `settled_qty`)
   - `revenueForTile` — уже из costs-tree (SETTLEMENT), OK
   - `purchaseCostsForTile` — для Ozon из `settled_qty * CC` (уже так в UE endpoint)
   - `netProfitForTile` — пересчитать: `payout - ozon_purchase(settled) - wb_purchase(order) - ads`

2. **`ProfitChart.tsx`:** daily данные — нужен daily breakdown из mp_costs или новый endpoint `/dashboard/settlement-chart`.

3. **Карточка "Выкупы":** count показывает `settled_qty` для Ozon вместо `mp_sales.sales_count`. Тултип: "Ozon: расчетные операции (settlement)".

4. **Buyout %:** Для Ozon бессмыслен в settlement-mode (заказы и выкупы на разных осях). Скрыть или показать "N/A".

**Плюсы:**
- 100% точность на ЛЮБОМ периоде (даже 1 день)
- Совпадение с ЛК Ozon (финотчет)
- Прибыль всегда корректна (revenue и purchase на одной оси)
- UE endpoint уже работает на этой логике — унификация

**Минусы:**
- Карточка "Заказы" (ORDER) и "Выкупы" (SETTLEMENT) на разных осях — buyout % теряет смысл для Ozon
- ProfitChart требует нового daily-источника данных
- `mp_costs` не содержит `settlement_revenue` — нужна миграция + изменение sync
- Пользователи привыкшие к "выкупы = сколько купили" увидят "выкупы = за что рассчитались"
- orders_count vs settled_count в заголовке может путать

**Сложность:** ~12 часов (миграция, sync, RPC, 2 компонента фронтенд)

**Точность:** 1д=100%, 7д=100%, 30д=100%, 90д=100%

---

### Вариант B: Dual-axis с разделением блоков

**Суть:** Не пытаемся привести все к одной оси. Вместо этого явно разделяем блоки дашборда на "Заказы/Воронка" (ORDER) и "Финансы/Прибыль" (SETTLEMENT). Каждый блок честен в своей оси.

**Архитектура блоков:**

```
+-- ORDER-axis (mp_sales) ----------------+  +-- SETTLEMENT-axis (costs-tree) --------+
| Заказы (count, revenue)                 |  | Начислено (total_accrued)              |
| SalesChart (daily orders/revenue)       |  | Удержания МП (deductions)              |
| ConversionChart (orders->sales %)       |  | К перечислению (payout)                |
| Воронка (заказы->выкупы->возвраты)      |  | Прибыль = payout - purchase - ads      |
+-----------------------------------------+  | ProfitWaterfall                        |
                                              | Per-MP profit                          |
                                              +----------------------------------------+
```

**Формулы:**

```
# ORDER-блок (без изменений)
  Карточка "Заказы":  orders_count, revenue из mp_sales (ORDER)
  SalesChart:         daily из mp_sales (ORDER)
  ConversionChart:    sales / orders * 100% (ORDER) -- корректно, одна ось

# SETTLEMENT-блок
  Карточка "Выкупы":
    УДАЛИТЬ count (бессмысленен cross-axis).
    ПЕРЕИМЕНОВАТЬ -> "Начислено" (total_accrued)
    value = total_payout (из costs-tree)

  Карточка "Чистая прибыль":
    profit = total_payout - purchase - ads
    WB purchase  = purchase_price * sales_count (ORDER = SETTLEMENT для WB)
    Ozon purchase = purchase_price * settled_qty (SETTLEMENT)
    -> revenue (costs-tree) и purchase на одной оси

  Карточка "Себестоимость":
    WB:   purchase_price * mp_sales.sales_count (ORDER)
    Ozon: purchase_price * mp_costs.settled_qty (SETTLEMENT)
    ТУЛТИП: "Ozon: по дате расчета, WB: по дате заказа"

  ProfitWaterfall:
    revenue = costs_tree_sales (SETTLEMENT)
    purchase = Ozon settled, WB order
    profit = payout - purchase - ads

  ProfitChart:
    daily profit = daily_revenue(mp_sales) * profitMargin(settlement_period)
    БЕЗ ИЗМЕНЕНИЙ -- уже использует period-level margin, оценка приемлема.

  Per-MP profit:
    profit_mp = payout_mp - purchase_mp - ad_mp
    purchase_mp: Ozon = settled_qty*CC, WB = sales_count*CC
```

**Что нужно в бэкенде:**

1. **RPC `get_dashboard_summary` НЕ менять** (оставляем order-based для карточки "Заказы").

2. **Прибыль убрать из RPC** — считать на фронтенде:
```
profit = payout(costs-tree) - purchase(UE endpoint) - ads(RPC)
```
UE endpoint уже корректно считает purchase: Ozon=settled_qty*CC, WB=sales_count*CC.

3. **Добавить `settled_purchase` и `settled_sales_count` в costs-tree response:**
```python
# В dashboard.py, _fetch_costs_tree_merged() или get_costs_tree RPC:
# Для Ozon: агрегировать settled_qty и purchase из mp_costs
settled_query = supabase.table("mp_costs") \
    .select("product_id, settled_qty") \
    .eq("user_id", user_id) \
    .eq("marketplace", "ozon") \
    .gte("date", date_from) \
    .lte("date", date_to)
if fulfillment_type:
    settled_query = settled_query.eq("fulfillment_type", fulfillment_type)
settled_result = settled_query.execute()

total_settled_qty = sum(int(r.get("settled_qty", 0) or 0) for r in settled_result.data)
# join с mp_products для purchase
settled_purchase = sum(
    float(products[r["product_id"]].get("purchase_price", 0)) * int(r.get("settled_qty", 0) or 0)
    for r in settled_result.data if r["product_id"] in products
)

# Добавить в response:
result["settled_sales_count"] = total_settled_qty
result["settled_purchase"] = round(settled_purchase, 2)
```

4. ЛИБО использовать уже загруженный UE endpoint (проще, но создает зависимость).

**Что нужно на фронтенде:**

1. **`DashboardPage.tsx`:**
   - Карточку "Выкупы" переименовать: value = `revenueForTile` (costs-tree, SETTLEMENT), убрать count или показать `settled_count`
   - `purchaseCostsForTile`: приоритет — UE endpoint (он уже корректен)
   - `netProfitForTile`: `payout - purchase(UE) - ads`

2. **Тултипы:** добавить пояснения "Ozon: по дате финоперации" на карточки Начислено, Прибыль, Себестоимость.

3. **`ProfitWaterfall.tsx`:** purchase из `purchaseCostsForTile` (уже settlement-based через UE).

4. **Buyout %:** оставить в карточке "Заказы" (order-based, корректно). Убрать из карточки "Выкупы".

**Плюсы:**
- Каждый блок честен в своей оси — нет смешивания
- Минимальные изменения в sync pipeline
- Прибыль корректна на любом периоде
- ConversionChart корректен (order-based)
- Тултипы объясняют разницу

**Минусы:**
- Карточка "Выкупы" теряет интуитивный count ("сколько купили")
- Пользователь должен понимать двойственность осей
- UE endpoint нагружается при каждой загрузке дашборда (уже загружается)
- ProfitChart daily — приблизительная оценка (margin * daily_revenue)

**Сложность:** ~8 часов (1 новое поле в costs-tree response, фронтенд-рефакторинг 4 компонентов, тултипы)

**Точность:** 1д=95%, 7д=98%, 30д=99%, 90д=99%

---

### Вариант C: Ozon Revenue Reconciliation (posting-level)

**Суть:** Обогатить `mp_sales` (ORDER) данными из Finance API через `posting_number`. Ozon Finance API возвращает `posting_number` для каждой финансовой операции. Связав posting с mp_sales, можно добавить `settlement_date` в mp_sales — и знать, КОГДА заказ был рассчитан. Это позволяет строить revenue на ЛЮБОЙ оси по выбору.

**Как работает:**

```
1. sync_costs_ozon: /v3/finance/transaction/list -> каждая операция имеет:
   - operation_date (settlement date)
   - posting.posting_number
   - amount, commission, services

2. sync_sales_ozon: /v1/analytics/data -> агрегаты по дням (НЕТ posting_number)
   -> НЕ подходит для связи

3. НОВЫЙ SYNC: /v3/posting/fbs/list или /v3/posting/fbo/list -> каждый posting имеет:
   - posting_number
   - created_at (=order_date)
   - products[]: {sku, quantity, price}

4. Связь: posting_number -> mapping ORDER_date <-> SETTLEMENT_date
```

**Новая таблица:**
```sql
CREATE TABLE mp_ozon_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  posting_number TEXT NOT NULL,
  order_date DATE NOT NULL,         -- created_at из posting
  settlement_date DATE,             -- operation_date из finance
  product_id UUID REFERENCES mp_products(id),
  quantity INT DEFAULT 1,
  price NUMERIC DEFAULT 0,
  payout NUMERIC DEFAULT 0,         -- из finance
  settled BOOLEAN DEFAULT FALSE,
  fulfillment_type VARCHAR(10) DEFAULT 'FBO',
  UNIQUE(user_id, posting_number, product_id)
);
CREATE INDEX idx_ozon_postings_order ON mp_ozon_postings(user_id, order_date);
CREATE INDEX idx_ozon_postings_settle ON mp_ozon_postings(user_id, settlement_date);
```

**Формулы (фронтенд без изменений, бэкенд переключает ось):**

```
# Дашборд: ВСЕ метрики на ORDER axis, но purchase корректен
  revenue  = mp_ozon_postings WHERE order_date IN range (ORDER)
  purchase = mp_ozon_postings WHERE order_date IN range * purchase_price (ORDER)
  payout   = mp_ozon_postings WHERE order_date IN range AND settled=true (ORDER!)

  -> Все на одной оси (ORDER), Rule #43 соблюден
  -> profit = payout(order) - purchase(order) - ads

# Альтернативный режим: settlement view
  revenue  = mp_ozon_postings WHERE settlement_date IN range
  purchase = ... WHERE settlement_date IN range * CC
  payout   = ... WHERE settlement_date IN range
  -> Все на SETTLEMENT оси, Rule #43 соблюден
```

**Что нужно в бэкенде:**

1. **Новый sync метод `sync_ozon_postings`:**
```python
async def sync_ozon_postings(self, date_from, date_to):
    """Синхронизация Ozon postings (FBO + FBS) с posting_number."""
    # FBO postings
    fbo_list = await self.ozon_client.get_fbo_postings(date_from, date_to)
    # FBS postings
    fbs_list = await self.ozon_client.get_fbs_postings(date_from, date_to)

    for posting in fbo_list + fbs_list:
        posting_number = posting["posting_number"]
        order_date = posting["created_at"][:10]
        for product in posting["products"]:
            # upsert в mp_ozon_postings
            ...

    # Связь с finance: обогащение settlement_date
    finance_data = await self.ozon_client.get_finance_transactions(date_from, date_to)
    for txn in finance_data:
        posting_number = txn["posting"]["posting_number"]
        settlement_date = txn["operation_date"][:10]
        # UPDATE mp_ozon_postings SET settlement_date, payout, settled=true
        ...
```

2. **Новые методы в `ozon_client.py`:**
```python
async def get_fbo_postings(self, date_from, date_to, limit=1000):
    """Ozon /v3/posting/fbo/list"""
    payload = {
        "dir": "ASC",
        "filter": {
            "since": date_from.isoformat() + "T00:00:00Z",
            "to": date_to.isoformat() + "T23:59:59Z",
        },
        "limit": limit,
        "offset": 0,
    }
    return await self._request("POST", "/v3/posting/fbo/list", json=payload)

async def get_fbs_postings(self, date_from, date_to, limit=1000):
    """Ozon /v3/posting/fbs/list"""
    ...
```

3. **Миграция 021:** создание `mp_ozon_postings`, индексы.

4. **Изменения в RPC:** для Ozon запрос к `mp_ozon_postings` вместо `mp_sales`:
```sql
-- Ozon revenue/purchase на ORDER axis (из postings)
SELECT
  SUM(op.quantity) as sales_count,
  SUM(op.price * op.quantity) as revenue,
  SUM(p.purchase_price * op.quantity) as purchase
FROM mp_ozon_postings op
JOIN mp_products p ON op.product_id = p.id
WHERE op.order_date BETWEEN p_date_from AND p_date_to
  AND op.user_id = p_user_id;
```

**Что нужно на фронтенде:**

1. Практически БЕЗ изменений — RPC возвращает данные в том же формате.
2. Опционально: toggle "по дате заказа / по дате расчета" в FilterPanel.
3. Тултип на карточке "Выкупы": "Ozon: только проведенные заказы за период".

**Плюсы:**
- Самый точный вариант — posting-level granularity
- Фронтенд почти без изменений
- Позволяет toggle ORDER/SETTLEMENT в UI
- Можно показать "непроведенные" заказы Ozon точно (settled=false)
- Buyout % корректен (все на ORDER оси)
- Масштабируется на 100+ SKU (posting_number уникален)

**Минусы:**
- Самый трудоемкий: новая таблица, новый sync, 2 новых API endpoint в ozon_client
- Rate limits Ozon API: `/v3/posting/fbo/list` имеет пагинацию, для 1000+ заказов/мес может быть медленным
- Ozon FBO postings API может не возвращать ВСЕ нужные данные
- Дублирование данных: mp_sales (analytics) + mp_ozon_postings (posting-level)
- Settlement_date может быть NULL для свежих заказов (еще не рассчитаны)
- Первичная миграция: нужно backfill за прошлые периоды

**Сложность:** ~16 часов (новая таблица, 2 API метода, sync метод, RPC, backfill скрипт)

**Точность:** 1д=98%, 7д=99%, 30д=100%, 90д=100%

---

### Вариант D: Disclaimer + Period Smoothing (быстрый фикс)

**Суть:** Минимальные изменения. Оставляем текущую cross-axis логику, но:
1. Добавляем visual disclaimer на карточки при marketplace=ozon и period < 14д
2. Автоматическое "расширение окна" для Ozon: при 7д фактически запрашиваем 10д и усредняем
3. Тултипы с объяснением расхождения

**Реализация:**

```
# Smoothing: при period <= 7д для Ozon расширяем запрос на +/-2 дня
  effective_date_from = date_from - 2d  (для Ozon costs-tree)
  effective_date_to   = date_to + 2d    (для Ozon costs-tree)
  -> Сглаживает settlement lag (обычно 1-3 дня)

# Карточка "Выкупы" -- БЕЗ ИЗМЕНЕНИЙ
  revenue = costs_tree (SETTLEMENT)
  count   = mp_sales.sales_count (ORDER)

# Прибыль -- БЕЗ ИЗМЕНЕНИЙ (cross-axis, но со сглаживанием)
  profit = payout(smoothed_SETTLEMENT) - purchase(ORDER) - ads

# Disclaimer: визуальный индикатор
  if (marketplace includes ozon && periodDays <= 14):
    показать "Данные Ozon могут расходиться на коротких периодах (1-3 дня задержки расчетов)"
```

**Что нужно в бэкенде:**

1. **Параметр `ozon_smoothing` в costs-tree:** расширение окна запроса для Ozon на +/-N дней.
```python
# dashboard.py, get_costs_tree endpoint:
if marketplace == 'ozon' and smoothing_days > 0:
    effective_from = (datetime.strptime(date_from, "%Y-%m-%d")
                      - timedelta(days=smoothing_days)).strftime("%Y-%m-%d")
    effective_to = (datetime.strptime(date_to, "%Y-%m-%d")
                    + timedelta(days=smoothing_days)).strftime("%Y-%m-%d")
```

2. ЛИБО вообще ничего не менять в бэкенде (только фронтенд).

**Что нужно на фронтенде:**

1. **Disclaimer компонент:**
```tsx
// components/Dashboard/OzonDisclaimer.tsx
export function OzonDisclaimer({ periodDays, marketplace }: Props) {
  const showWarning = (marketplace === 'ozon' || marketplace === 'all') && periodDays <= 14;
  if (!showWarning) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2
                    text-xs text-amber-800 mb-3">
      <span className="font-medium">Ozon:</span> данные прибыли и выкупов могут расходиться
      на периодах до 14 дней из-за задержки финансовых расчетов (1-5 дней).
      Для точных данных используйте период 30+ дней.
    </div>
  );
}
```

2. **Тултипы на карточках:**
   - Карточка "Выкупы": добавить `\nOzon: выручка по дате расчета, кол-во по дате заказа`
   - Карточка "Прибыль": добавить `\nOzon: payout по дате расчета, закупка по дате заказа`

3. **DashboardPage.tsx:** вставить `<OzonDisclaimer>` перед grid карточек.

**Плюсы:**
- Минимум изменений (1 компонент, 3 тултипа)
- Не ломает существующую логику
- Быстрая реализация
- Пользователь информирован о расхождении
- На 30д+ точность и так приемлемая (~97%)

**Минусы:**
- НЕ решает проблему — маскирует её
- На 1 день прибыль может быть абсурдной (x2 или отрицательная)
- Карточка "Выкупы" все ещё показывает "1783 руб, 1 шт" — абсурд
- Профессиональные продавцы заметят несоответствие с ЛК
- Smoothing может давать неточные абсолютные числа

**Сложность:** ~4 часа (1 компонент, тултипы, опционально smoothing)

**Точность:** 1д=70%, 7д=90%, 30д=97%, 90д=99%

---

### Сравнительная таблица

| Критерий | A (Settlement) | B (Dual-axis) | C (Reconciliation) | D (Disclaimer) |
|----------|:-:|:-:|:-:|:-:|
| Точность 1д | 100% | 95% | 98% | 70% |
| Точность 7д | 100% | 98% | 99% | 90% |
| Точность 30д | 100% | 99% | 100% | 97% |
| Совпадение с ЛК Ozon | Полное | Частичное | Полное | Нет |
| Buyout % для Ozon | Бессмыслен | Бессмыслен | Корректен | Cross-axis |
| Изменения backend | Миграция + sync + RPC | Поле в response | Таблица + sync + 2 API | Минимум |
| Изменения frontend | 4 компонента | 4 компонента | 1-2 компонента | 1 компонент |
| Rule #43 соблюден | Да | Да (per-block) | Да | Нет |
| Сложность | ~12ч | ~8ч | ~16ч | ~4ч |

### Рекомендация аналитика

**Для 5 SKU сейчас:** Вариант **B (Dual-axis)** — оптимальный баланс точности и трудоемкости. Прибыль корректна, Rule #43 соблюден per-block, фронтенд-изменения управляемые.

**На перспективу 100+ SKU:** Вариант **C (Reconciliation)** — единственный, который дает posting-level точность и позволяет toggle осей. Но реализовать стоит позже, когда появятся реальные 100+ SKU клиенты.

**Быстрый hotfix (если нужно сегодня):** Вариант **D (Disclaimer)** — 4 часа, не ломает ничего, информирует пользователя.

**НЕ рекомендую:** Вариант A в чистом виде — потеря buyout % для Ozon слишком болезненна для продавцов.

### Предлагаемый план действий

```
Phase 1 (сегодня, 4ч):   Вариант D -- disclaimer + тултипы
Phase 2 (эта неделя, 8ч): Вариант B -- dual-axis, прибыль через settlement purchase
Phase 3 (будущее, 16ч):   Вариант C -- posting-level reconciliation (когда 100+ SKU)
```

---

## Предложения дизайнера

<!-- UX/UI предложения для решения cross-axis проблемы Ozon -->

### Вариант A: "Двойная подстрочка" (Dual-Source Label)

**Концепция:** Вместо одного secondaryValue карточка показывает ДВЕ строки подписей, каждая с меткой источника. Пользователь видит обе цифры в контексте, не задумываясь об "осях" — просто "по заказам" и "по финансам".

**Layout — Desktop (lg:grid-cols-4):**
```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ 🛒 Заказы              +12% │  │ 🛍 Выкупы              +8%  │
│                              │  │                              │
│  47                          │  │  1 783 ₽                     │
│  3 450 ₽ · заказы            │  │  по финотчёту                │
│                              │  │  4 шт · по финотчёту         │
│                              │  │  1 шт · по заказам           │
└─────────────────────────────┘  └─────────────────────────────┘
```

**Layout — Mobile (grid-cols-2):**
```
┌───────────────┐ ┌───────────────┐
│ 🛒 Заказы     │ │ 🛍 Выкупы     │
│  47           │ │  1 783 ₽      │
│  3 450₽       │ │  4шт·финотчёт │
│               │ │  1шт·заказы   │
└───────────────┘ └───────────────┘
```

**UX-паттерн:** Stripe Dashboard — основная метрика крупно, два контекста мелким шрифтом.

**Тултип карточки "Выкупы":**
```
Выручка из финотчёта маркетплейса (проведённые операции).

📋 По финотчёту: 1 783₽ за 4 товара
   L-карнитин (3), Витамин D3 (1)
📦 По заказам: 863₽ за 1 товар
   Тестобустер (1)

Разница возникает из-за задержки проведения:
заказ 12 февраля → расчёт 15 февраля.
На периодах 7+ дней расхождение минимально.
```

**Edge cases:**
- Нет settlement данных → показываем только "X шт · по заказам", без финотчётной строки
- Нет заказов → показываем "0 шт · по заказам" (серым)
- 0 прибыль → обе строки есть, прибыль = 0₽, красный accent
- WB (нет cross-axis проблемы) → одна строка как сейчас ("4 шт · выкуп 81%")

**Плюсы:**
- Минимальное изменение текущего UI — расширяем SummaryCard, не меняем grid
- Пользователь видит обе цифры, выбирает по контексту
- Нет дополнительного клика/переключения
- WB-карточки не меняются — изменение только при marketplace=ozon или all

**Минусы:**
- Карточка становится выше (3 строки вместо 2) — может сломать выравнивание grid
- "по финотчёту" / "по заказам" — технический язык, не все поймут
- Визуально тяжелее — больше текста на маленькой карточке

---

### Вариант B: "Финансы как truth" (Settlement-First)

**Концепция:** Принимаем парадигму Ozon ЛК: **основная валюта дашборда — settlement (финотчёт)**. Количество штук для Ozon тоже берём из settlement (mp_costs.settled_qty). Карточка "Выкупы" показывает ТОЛЬКО settlement-данные. Карточка "Заказы" — ТОЛЬКО order-данные. Никакого смешения.

**Layout — Desktop:**
```
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ 🛍 Заказы     │ │ 🛒 Выкупы     │ │ 📦 Закупка    │ │ 💰 Прибыль    │
│               │ │               │ │               │ │               │
│  47           │ │  1 783 ₽      │ │  892 ₽        │ │  341 ₽        │
│  3 450₽ сумма │ │  4 шт         │ │  ∅ 223₽/шт   │ │  маржа 19.1%  │
│               │ │  выкуп 8.5%   │ │               │ │               │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
                     ↑ всё из                ↑ purchase_price
                     settlement              × settled_qty
```

**Ключевое изменение:**
- `salesCountForTile` для Ozon = `settled_qty` (из mp_costs или costs-tree), НЕ mp_sales.sales
- `buyoutPercent` для Ozon = `settled_qty / orders_count × 100%`
- `purchaseCostsForTile` для Ozon = `purchase_price × settled_qty` (уже так в UE)
- WB: без изменений (order-based, нет проблемы)

**UX-паттерн:** Ozon ЛК (Финансы → Финансовый отчёт) — все числа settlement-based.

**Тултип карточки "Выкупы":**
```
Проведённые продажи из финотчёта Ozon.

Выручка: 1 783₽ (4 товара)
Период проведения: 13–15 февраля

ℹ Количество и суммы основаны на дате
расчёта Ozon (не дате заказа).
```

**Edge cases:**
- Нет settlement → карточка "Выкупы" = 0₽, 0 шт (корректно — Ozon ещё не провёл)
- Нет заказов → карточка "Заказы" = 0, "Выкупы" может быть >0 (старые заказы проведены)
- Buyout% может быть >100% (4 settlement за период vs 1 заказ) — ограничиваем 100% или скрываем
- 0 прибыль → settlement-based, всё корректно

**Плюсы:**
- **Полностью устраняет cross-axis проблему** — все финансовые карточки на одной оси
- Совпадает с тем, что пользователь видит в ЛК Ozon (привычно)
- Формула прибыли корректна: settlement_payout - settlement_purchase - ads
- Чистый UI — нет дополнительных подписей, меток, переключателей

**Минусы:**
- Buyout% для Ozon теряет смысл (settled_qty может быть из других дней) — нужно скрыть или заменить
- Количество "выкупов" не совпадает с "заказами" интуитивно (пользователь ждёт: "47 заказов → ~40 выкупов")
- Требует backend-изменений: фронтенд должен получать settled_qty из costs-tree или отдельного RPC
- На коротких периодах (1-3 дня) числа могут выглядеть "странно" для пользователя

---

### Вариант C: "Заказы как truth + disclaimer" (Order-First with Caveat)

**Концепция:** Обратный подход — ВСЕ карточки переключить на order-based ось для Ozon. Выручку и прибыль считаем от `mp_sales` (как заказы). При этом внизу дашборда (в MarketplaceBreakdown) показываем settlement-данные как "финансовый отчёт".

**Layout — Desktop:**
```
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ 🛍 Заказы     │ │ 🛒 Выкупы     │ │ 📦 Закупка    │ │ 💰 Прибыль    │
│               │ │               │ │               │ │               │
│  47           │ │  863 ₽        │ │  445 ₽        │ │  ~220 ₽       │
│  3 450₽ сумма │ │  1 шт         │ │  ∅ 445₽/шт   │ │  ~маржа 25%   │
│               │ │  выкуп 2.1%   │ │               │ │  ⚠ оценка     │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
                     ↑ всё из mp_sales
```

**Информационная полоска (под карточками, только при Ozon/all):**
```
┌──────────────────────────────────────────────────────────────────────┐
│  ℹ  Данные Ozon по заказам. Финотчёт (проведённые) — в карточке     │
│     OZON ниже. Расхождение с ЛК Ozon нормально на периодах <7 дней.│
└──────────────────────────────────────────────────────────────────────┘
```

**UX-паттерн:** Shopify Analytics — order-based с caveat "reports may differ from financial statements".

**Тултип карточки "Прибыль":**
```
⚠ Оценочная прибыль на основе заказов.

Выручка (по заказам): 863₽
− Закупка: 445₽
− Реклама: 198₽
= Прибыль (оценка): ~220₽

Точная прибыль (по финотчёту) — в карточке
OZON ниже.
```

**Edge cases:**
- Нет settlement → не влияет (карточки order-based)
- Нет заказов → всё = 0 (корректно)
- 0 прибыль → корректно
- Прибыль "оценочная" — пользователь может не доверять числам
- WB: без изменений

**Плюсы:**
- Order-based числа интуитивно понятны ("заказал → купил")
- Buyout% корректен (orders → sales из той же таблицы)
- Минимальный backend-рефакторинг — mp_sales уже есть

**Минусы:**
- **Прибыль становится оценочной** — удержания МП из order-based данных неточные
- Пользователь видит числа, не совпадающие с ЛК Ozon (settlement-based)
- Знак "~оценка" на главной метрике прибыли снижает доверие
- Дублирование данных: карточки (order-based) + MarketplaceBreakdown (settlement-based) — путаница

---

### Вариант D: "Две зоны" (Split Dashboard)

**Концепция:** Визуально разделить дашборд на две зоны: **"Продажи" (order-based)** и **"Финансы" (settlement-based)**. Каждая зона со своим заголовком. Пользователь считывает: "слева — что продал, справа — что заработал".

**Layout — Desktop (lg:grid-cols-4):**
```
Продажи                                 Финансы
┌───────────────┐ ┌───────────────┐    ┌───────────────┐ ┌───────────────┐
│ 🛍 Заказы     │ │ 📦 Себест-ть  │    │ 💳 Начислено  │ │ 💰 Прибыль    │
│               │ │               │    │               │ │               │
│  47           │ │  892 ₽        │    │  1 783 ₽      │ │  341 ₽        │
│  3 450₽ сумма │ │  ∅ 223₽/шт   │    │  4 шт провед. │ │  маржа 19.1%  │
└───────────────┘ └───────────────┘    └───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐    ┌───────────────┐ ┌───────────────┐
│ 📈 Конверсия  │ │ 📊 Реклама    │    │ 🏦 Удержания  │ │ 📤 Выплата    │
│               │ │               │    │               │ │               │
│  2.1%         │ │  198 ₽        │    │  1 250 ₽      │ │  533 ₽        │
│  выкуп        │ │  ДРР 5.7%     │    │  ком.+лог.    │ │  на р/с       │
└───────────────┘ └───────────────┘    └───────────────┘ └───────────────┘
```

**Layout — Mobile (grid-cols-2):**
```
── Продажи ──────────────
┌──────────┐ ┌──────────┐
│ Заказы   │ │ Закупка  │
│  47      │ │  892₽    │
│  3 450₽  │ │  ∅ 223₽  │
├──────────┤ ├──────────┤
│ Конверсия│ │ Реклама  │
│  2.1%    │ │  198₽    │
└──────────┘ └──────────┘

── Финансы ──────────────
┌──────────┐ ┌──────────┐
│ Начислено│ │ Прибыль  │
│  1 783₽  │ │  341₽    │
│  4 шт    │ │  19.1%   │
├──────────┤ ├──────────┤
│ Удержания│ │ Выплата  │
│  1 250₽  │ │  533₽    │
└──────────┘ └──────────┘
```

**UX-паттерн:** GA4 (Acquisition vs Monetization), Amplitude (Events vs Revenue), Mixpanel (Funnels vs Revenue).

**Тултипы:**
- Заголовок "Продажи": "Данные по дате размещения заказа. Показывают что клиенты заказали в выбранном периоде."
- Заголовок "Финансы": "Данные из финотчёта (расчёт с маркетплейсом). Могут включать проведение заказов из прошлых дней."
- Карточка "Начислено": "Заменяет «Выкупы». Выручка из финотчёта Ozon за проведённые операции. Товары могли быть заказаны в другие дни."

**Edge cases:**
- Нет settlement → зона "Финансы" пустая (skeleton или "Нет данных финотчёта за период")
- Нет заказов → зона "Продажи" с нулями (нормально)
- WB: зоны остаются, но визуально одинаковы (у WB нет расхождения) — можно объединить зоны для WB
- Период 1 день → расхождение максимально видно, зоны помогают понять
- 0 прибыль → корректно в зоне "Финансы"

**Плюсы:**
- **Самое чистое разделение** — нет смешения осей, нет disclaimers
- Паттерн знаком по GA4/Amplitude — продвинутые продавцы оценят
- Каждое число "честное" в своём контексте
- Прибыль всегда settlement-based (корректная формула)
- Масштабируется: можно добавить зону "Логистика" и т.д.

**Минусы:**
- **Серьёзный редизайн** — 8 карточек в grid 4x2 надо перекомпоновать
- На мобиле 8 карточек + 2 заголовка = длинный скролл
- Пользователь-новичок может не понять, зачем два блока
- "Начислено" вместо "Выкупы" — новый термин, нужно привыкнуть
- WB не имеет этой проблемы → разный layout для разных МП добавляет сложность

---

### Сводная таблица

| Критерий | A: Dual Label | B: Settlement-First | C: Order-First | D: Split Dashboard |
|----------|:---:|:---:|:---:|:---:|
| Устраняет cross-axis | Частично | **Полностью** | Частично | **Полностью** |
| Совпадает с ЛК Ozon | Да (в тултипе) | **Да** | Нет | Да (зона "Финансы") |
| Buyout% корректен | Нет (скрыть) | Нет (скрыть) | **Да** | **Да** (в зоне "Продажи") |
| Минимум UI-изменений | **Да** | Средне | Средне | Нет |
| Минимум backend-изменений | **Да** | Средне | **Да** | Средне |
| Понятен новичку | Средне | **Да** | Средне | Нет |
| Mobile-friendly | **Да** | **Да** | **Да** | Средне |
| Доверие к прибыли | **Высокое** | **Высокое** | Низкое (оценка) | **Высокое** |

### Рекомендация дизайнера

**Рекомендую вариант B (Settlement-First)** как основной, с элементами варианта A для карточки "Выкупы".

Обоснование:
1. Продавец приходит за ответом "сколько заработал" — settlement-based прибыль единственно верная
2. Совпадение с ЛК Ozon = доверие и отсутствие вопросов "почему числа разные"
3. Buyout% для Ozon можно заменить на "Avg check" или скрыть (он некорректен при settlement anyway)
4. Карточка "Заказы" остаётся order-based (это её прямое назначение) — разделение интуитивно

Гибрид B+A:
- Основное число = settlement (выручка, прибыль, закупка)
- Подстрочник = "4 шт проведено" (settlement)
- Тултип = обе цифры: "По финотчёту: 1 783₽ (4 шт) · По заказам: 863₽ (1 шт)"
- Карточка "Заказы" — order-based (без изменений)
- Buyout% для Ozon → заменить на settlement_count/orders_count или скрыть

---

## Решения (финальные)

<!-- После обсуждения — выбранные решения -->

_Ожидается..._
