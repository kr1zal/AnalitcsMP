# Plan: Ozon Order Analytics — Полная раскладка заказов

> Дата: 26.02.2026
> Источник: аудит OZON!!!.md по официальной документации docs.ozon.ru (dockAPIozon/1-4.md)
> Статус: TODO

---

## Цель

Раскладывать каждый Ozon-заказ на составляющие: revenue, комиссия, логистика, прочие удержания, profit — на дату ЗАКАЗА (ось заказов), а не на дату расчёта (ось финансов).

Сейчас: `logistics=0`, `storage_fee=0`, `other_fees=0` для ВСЕХ Ozon orders в mp_orders.

---

## Фаза 1: Парсинг posting_services + item_services (P0)

### Файлы: `backend/app/services/sync_service.py`

**Что сделать:**

1. В `sync_orders_ozon()` (~строка 2631-2637) — парсить финансовые данные из posting response:

```python
# Стратегия: суммировать оба источника (один из них всегда нули)
# FBS: posting_services заполнены, item_services = deprecated
# FBO: posting_services = нули, item_services заполнены
posting_services = financial.get("posting_services", {})
item_services_total = {}
for product in financial.get("products", []):
    for key, val in product.get("item_services", {}).items():
        item_services_total[key] = item_services_total.get(key, 0) + abs(float(val or 0))

def _get_svc(key):
    return abs(float(posting_services.get(key, 0) or 0)) + item_services_total.get(key, 0)

logistics_cost = sum([
    _get_svc("marketplace_service_item_deliv_to_customer"),
    _get_svc("marketplace_service_item_direct_flow_trans"),
    _get_svc("marketplace_service_item_return_flow_trans"),
    _get_svc("marketplace_service_item_pickup"),
])
fulfillment_cost = sum([
    _get_svc("marketplace_service_item_dropoff_ff"),
    _get_svc("marketplace_service_item_dropoff_pvz"),
    _get_svc("marketplace_service_item_dropoff_sc"),
    _get_svc("marketplace_service_item_fulfillment"),
])
return_cost = sum([
    _get_svc("marketplace_service_item_return_after_deliv_to_customer"),
    _get_svc("marketplace_service_item_return_not_deliv_to_customer"),
    _get_svc("marketplace_service_item_return_part_goods_customer"),
])

row["logistics"] = logistics_cost
row["other_fees"] = fulfillment_cost + return_cost
```

2. **Тестирование:** Сравнить суммы posting_services из постингов с services из finance/transaction/list за тот же период. Должны ~совпадать.

### Риск
- `posting_services` и `item_services` — **НЕДОКУМЕНТИРОВАННЫЕ** поля (нет в docs.ozon.ru)
- Ozon может удалить без предупреждения
- **Fallback:** `/v3/finance/transaction/list` (полностью документированный)

### Результат
- mp_orders.logistics, other_fees заполнены для Ozon
- Order Monitor показывает реальную логистику per-order
- Profit per-order на дату заказа

---

## Фаза 2: Фикс delivery_schema (7 значений)

### Файлы: `backend/app/services/sync_service.py`

**Что сделать:**

1. В `sync_costs_ozon()` — обработать все 7 delivery_schema:

```python
DELIVERY_SCHEMA_MAP = {
    "FBS": "FBS",
    "FBO": "FBO",
    "RFBS": "FBS",        # rFBS = доставка продавцом → аналог FBS
    "FBP": "FBO",         # партнёрские склады → аналог FBO
    "CROSSBORDER": "FBS", # трансграничная → аналог FBS
    "FBOECONOMY": "FBO",  # эконом FBO → FBO
    "FBSECONOMY": "FBS",  # эконом FBS → FBS
}
ft = DELIVERY_SCHEMA_MAP.get(posting.get("delivery_schema"), "FBO")
```

2. В `sync_orders_ozon()` — аналогичный маппинг (если определяем FT из posting response).

### Результат
- Корректный fulfillment_type для всех типов доставки
- Нет потери данных для CROSSBORDER/RFBS/FBP

---

## Фаза 3: Фикс region=null для FBO

### Файлы: `backend/app/services/sync_service.py`

**Что сделать:**

1. FBO analytics_data не имеет поля `region` (подтверждено docs.ozon.ru)
2. Использовать `city` как fallback для FBO:

```python
analytics = posting.get("analytics_data", {})
if fulfillment_type == "FBO":
    region = analytics.get("city", "")  # FBO: нет region, берём city
    warehouse = analytics.get("warehouse_name", "")
else:
    region = analytics.get("region", "")
    warehouse = analytics.get("warehouse", "")
```

### Результат
- Нет null в mp_orders.region для FBO
- Географическая аналитика работает для обоих схем

---

## Фаза 4: Новый статус cancelled_from_split_pending

### Файлы: `backend/app/services/sync_service.py`

**Что сделать:**

1. Добавить в STATUS_MAP (уже в OZON!!!.md, нужно в код):

```python
"cancelled_from_split_pending": "cancelled",
```

### Результат
- Нет unknown status warnings в логах

---

## Фаза 5: Сохранять причины отмен (P2)

### Файлы: миграция + sync_service.py

**Что сделать:**

1. **Миграция 027:** добавить колонки в mp_orders:
```sql
ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(200);
ALTER TABLE mp_orders ADD COLUMN IF NOT EXISTS cancellation_initiator VARCHAR(20);
```

2. В sync_orders_ozon — парсить cancellation:
```python
# FBS: из cancellation объекта
if fulfillment_type == "FBS":
    cancellation = posting.get("cancellation", {})
    row["cancel_reason"] = cancellation.get("cancel_reason", "")
    row["cancellation_initiator"] = cancellation.get("cancellation_initiator", "")
# FBO: только cancel_reason_id (нужен справочник для текста)
else:
    row["cancel_reason"] = str(posting.get("cancel_reason_id", ""))
    row["cancellation_initiator"] = ""  # FBO не имеет этого поля
```

### Результат
- Аналитика "почему отменяют" для FBS
- Для FBO — хотя бы ID причины

---

## Фаза 6: Расширить обработку operation_types в Finance (P1)

### Файлы: `backend/app/services/sync_service.py`

**Что сделать:**

1. Добавить обработку критических новых operation_types:

```python
# Критический: исправленное начисление (может менять settled_qty!)
"OperationAgentDeliveredToCustomerCanceled": handle_as_delivery_correction,

# Компенсации (положительные суммы → в costs-tree)
"OperationDefectiveWriteOff": compensation,
"OperationLackWriteOff": compensation,
"MarketplaceSellerCompensationLossOfGoodsOperation": compensation,

# Рекламные услуги (в costs-tree как promotion)
"OperationElectronicServiceStencil": promotion,
"OperationElectronicServicesPromotionInSearch": promotion,
```

2. Расширить substring match для services:
```python
# Сейчас ловим: "Logistic", "LastMile"
# Добавить: "DeliveryCost", "DeliveryKGT"
logistics_keywords = ["Logistic", "LastMile", "DeliveryCost", "DeliveryKGT"]
```

### Результат
- 34 из 34 operation_types обработаны
- Точный costs-tree

---

## Порядок реализации

| # | Фаза | Сложность | Файлы | Приоритет |
|---|-------|-----------|-------|-----------|
| 1 | posting_services парсинг | Средняя | sync_service.py | **P0** |
| 2 | delivery_schema 7 значений | Простая | sync_service.py | **P0** |
| 3 | region=null FBO fix | Простая | sync_service.py | **P0** |
| 4 | cancelled_from_split_pending | Тривиальная | sync_service.py | **P0** |
| 5 | Причины отмен | Средняя | миграция + sync | P2 |
| 6 | operation_types + services | Средняя | sync_service.py | P1 |

**Фазы 1-4 — один коммит.** Фазы 5-6 — отдельные.

---

## Зависимости

- **OZON!!!.md** — полный аудит завершён (FBS, FBO, Finance, Analytics)
- **dockAPIozon/1-4.md** — официальная документация скопирована
- **ozon_audit/** — данные из Go SDK (вторичный источник)
- **Миграция** — нужна только для Фазы 5

## Проверка после реализации

1. `npm run build` — фронт компилируется
2. Ресинк Ozon данных (`/sync`)
3. Проверить mp_orders: logistics != 0 для Ozon
4. Сверка costs-tree с ЛК Ozon (`/reconcile`)
5. Order Monitor — логистика отображается
