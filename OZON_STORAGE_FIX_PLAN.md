# Ozon Per-Product Storage — Plan для точного совпадения UE с ЛК

## Статус: READY FOR IMPLEMENTATION
## Приоритет: P0 (последний gap 4.31₽ в UE matching)

---

## Проблема

UE profit для Д3К2 (21-26 фев): **наш = 2.01₽, ЛК = 6.32₽, gap = 4.31₽**.

Причина: Ozon Finance API (`/v3/finance/transaction/list`) возвращает storage charges как **account-level** операцию (`OperationMarketplaceServiceStorage`) **без items** (без привязки к товару). Наш `sync_costs_ozon` распределяет их поровну (1/N товаров). ЛК Ozon использует per-product распределение по объёму/весу.

### Конкретные числа (production, 21-26 Feb 2026)

**Storage для Д3К2 в mp_costs_details (order_date IS NULL):**
- 21 Feb: -34.12₽ (equal 1/3)
- 22 Feb: -34.12₽
- 23 Feb: -33.87₽
- 24 Feb: -33.80₽
- 25 Feb: -33.80₽
- 26 Feb: -33.80₽
- **Итого наш: -203.51₽**
- **ЛК Ozon: -199.20₽**
- **Diff: 4.31₽**

**CSV "Стоимость размещения" (28 дней):**
- Д3К2: 1015₽ (37.1%)
- L-Карнитин: 490₽ (17.9%)
- Тестостерон: 1232₽ (45.0%)
- Total: 2737₽

**ВАЖНО:** Prorating из CSV (1015/28×6 = 217.5₽) даёт ХУЖЕ чем equal distribution! Нужны именно daily per-product данные.

---

## Решение: Daily Per-Product Storage из Placement Report API

### Источник данных

Ozon Placement Report API возвращает **XLSX** с daily per-product storage.

**API endpoints (уже реализованы в `ozon_client.py`):**
1. `POST /v1/report/placement/by-products/create` — создать отчёт
2. `GET /v1/report/info` — проверить статус, получить URL файла
3. Download XLSX — скачать файл

**Лимиты API:** 5 вызовов в день, макс. период 31 день.

### XLSX структура (из `dockAPIozon/5.md`)

Формат файла (колонки):
```
Col 0:  Дата
Col 1:  SKU
Col 2:  Название товара
Col 3:  Баркод
Col 4:  Категория
Col 5:  Тип
Col 6:  Объём, л
Col 7:  Кол-во, шт
Col 8:  Бесплатно, шт
Col 9:  Бесплатно, л
Col 10: Платно, шт
Col 11: Стоимость размещения, руб  ← KEY FIELD
Col 12: Склад
```

Каждая строка = 1 день × 1 SKU × 1 склад. Нужна **агрегация по дням** (сумма всех складов для одного SKU за день).

---

## Фазы реализации

### Фаза 1: Обновить sync_storage_ozon (XLSX → daily per-product)

**Файл:** `backend/app/services/sync_service.py`, метод `sync_storage_ozon` (строка ~2929)

**Текущее поведение:** Парсит XLSX, агрегирует TOTAL за весь период по SKU, записывает в `mp_storage_costs` одной записью per product.

**Нужно:** Парсить XLSX с daily granularity. Каждая строка XLSX = (дата, SKU, склад, стоимость). Агрегировать по (дата, product_id) → SUM(стоимость) по всем складам. Записывать в `mp_storage_costs` per day.

**Изменения в mp_storage_costs:**
- Текущая структура: `date_from, date_to, storage_cost` (период = 28 дней)
- Нужно: `date DATE, storage_cost` (per day)

**Миграция 032:**
```sql
-- Добавить колонку date для daily storage
ALTER TABLE mp_storage_costs ADD COLUMN IF NOT EXISTS date DATE;
-- Перенести данные: если есть записи с date_from/date_to, конвертировать
-- (можно просто удалить старые данные и пересинхронизировать)
-- Создать уникальный индекс
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_storage_costs_daily
  ON mp_storage_costs(user_id, marketplace, product_id, date);
```

Или альтернативно — новая таблица `mp_storage_costs_daily`:
```sql
CREATE TABLE IF NOT EXISTS mp_storage_costs_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  marketplace VARCHAR(10) NOT NULL DEFAULT 'ozon',
  product_id UUID NOT NULL REFERENCES mp_products(id),
  date DATE NOT NULL,
  storage_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  volume_liters NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, marketplace, product_id, date)
);
ALTER TABLE mp_storage_costs_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own storage costs daily" ON mp_storage_costs_daily
  FOR ALL USING (auth.uid() = user_id);
```

### Фаза 2: Обновить UE endpoint

**Файл:** `backend/app/api/v1/dashboard.py`, строки ~438-499

**Текущий код (строки 438-499):**
1. Запрашивает `mp_storage_costs` (monthly) — prorates по дням → `per_product_storage` dict
2. Устанавливает `has_per_product_storage` flag
3. НО: НЕ использует `per_product_storage` — storage из `null_od_result` (equal distribution) всё равно накапливается

**Нужно:**
1. Запросить `mp_storage_costs_daily` WHERE date BETWEEN date_from AND date_to, per product
2. Если есть daily data → `has_per_product_storage = True`
3. В цикле `null_od_result` (строка 489): если `has_per_product_storage` и `subcategory == "Размещение товаров"` → **SKIP** (не накапливать equal-distributed storage)
4. После цикла: добавить per-product storage в payout: `ozon_order_date_by_product[pid]["payout"] -= per_product_storage[pid]`

**Конкретный код:**
```python
# В цикле null_od_result (строка 489):
for row in null_od_result.data:
    pid = row["product_id"]
    amt = float(row.get("amount", 0) or 0)
    cat = row.get("category", "")
    subcat = row.get("subcategory", "")
    ft_val = row.get("fulfillment_type", "FBO") or "FBO"

    # Skip equally-distributed storage if we have per-product daily data
    if has_per_product_storage and subcat == "Размещение товаров":
        continue

    _accumulate_od_row(pid, amt, cat, ft_val, subcat)

# После цикла: подставить реальный per-product storage
if has_per_product_storage:
    for pid, storage_cost in per_product_storage.items():
        if pid not in ozon_order_date_by_product:
            ozon_order_date_by_product[pid] = {"payout": 0.0, "revenue": 0.0}
        ozon_order_date_by_product[pid]["payout"] -= storage_cost
```

### Фаза 3: Автоматический sync storage в очереди

**Файл:** `backend/app/api/v1/sync_queue.py`

Добавить `storage` в автоматический sync queue. При обработке queue, после costs sync, также запускать `sync_storage_ozon`. Учесть лимит 5 вызовов в день — запускать storage sync **1 раз в день** (не каждые 30 минут).

### Фаза 4: Запуск и верификация

1. Применить миграцию 032 в Supabase
2. Задеплоить код
3. Вызвать `POST /sync/storage-ozon?days_back=28` на production
4. Проверить: Д3К2, 21-26 фев → profit ≈ 6₽

---

## Ключевые файлы

| Файл | Что менять |
|------|-----------|
| `backend/migrations/032_storage_costs_daily.sql` | Новая таблица/миграция |
| `backend/app/services/sync_service.py` | `sync_storage_ozon` → daily parsing |
| `backend/app/api/v1/dashboard.py` | UE endpoint → use daily storage |
| `backend/app/api/v1/sync_queue.py` | Storage в auto queue (1/day) |

## Зависимости

- `openpyxl` — уже установлен (requirements.txt)
- Ozon API credentials — уже на VPS (ozon_client_id, ozon_api_key)
- `ozon_client.py` методы `create_placement_report`, `get_report_info` — уже реализованы

## Риски

1. **API лимит 5/day** — storage sync нельзя запускать часто
2. **XLSX формат может измениться** — нужна защита от изменения колонок
3. **Новые товары** — если SKU из XLSX нет в mp_products, row пропускается (уже реализовано в sync_storage_ozon)
4. **Backfill** — при первом запуске нужно загрузить 28 дней данных

## Формула итоговая

```
# Ozon UE (order_date approach + daily per-product storage):
per_order_payout = SUM(mp_costs_details.amount WHERE order_date IN period AND subcategory != "Бонусы продавца")
daily_storage = SUM(mp_storage_costs_daily.storage_cost WHERE date IN period AND product_id = pid)
total_payout = per_order_payout - daily_storage
profit = total_payout - purchase_price × sales_count
```

## Ожидаемый результат

Д3К2, 21-26 фев:
- per_order_payout = 485.52₽
- daily_storage = ~199₽ (per-product from XLSX, should match ЛК)
- purchase = 280₽
- **profit ≈ 6₽** (match ЛК)
