# АУДИТ OZON SELLER API — 21.02.2026

## КОНТЕКСТ

Аудит всех используемых Ozon API эндпоинтов для нашего дашборда аналитики.
Цель: выявить неиспользуемые параметры/поля, потенциальные улучшения и подготовиться к deprecation 20.03.2026.

> **Примечание:** Ozon docs (docs.ozon.ru) заблокированы по geo-IP из текущего окружения. Анализ основан на: (1) codebase нашего проекта, (2) реальных ответов API зафиксированных в docs/ozon-audit-2026-02-20.md, (3) знаниях о Ozon Seller API из документации.

---

## 1. POST /v3/finance/transaction/list

**Наш файл:** `backend/app/services/ozon_client.py:302-317`
**Используется в:** `sync_costs_ozon()` (sync_service.py:1781)

### Что мы отправляем
```json
{
  "filter": {
    "date": {
      "from": "2026-01-22T00:00:00.000Z",
      "to": "2026-02-21T23:59:59.999Z"
    },
    "transaction_type": "all"
  },
  "page": 1,
  "page_size": 1000
}
```

### Доступные параметры filter (полный список)
| Параметр | Тип | Описание | Мы используем? |
|----------|-----|----------|----------------|
| `date.from` / `date.to` | datetime | Период (макс. 1 месяц) | ДА |
| `transaction_type` | string | "all" / конкретный тип | ДА ("all") |
| `posting_number` | string | Фильтр по номеру отправления | НЕТ |
| `operation_type` | string[] | Фильтр по типам операций | НЕТ |

### Поля ответа (per operation)
| Поле | Описание | Мы используем? | Потенциал |
|------|----------|----------------|-----------|
| `operation_id` | Уникальный ID операции | ДА (для details) | - |
| `operation_type` | Тип операции (enum) | ДА (классификация) | - |
| `operation_type_name` | Человекочитаемое имя типа | НЕТ | UI: показ в деталях |
| `operation_date` | Дата расчёта (settlement) | ДА | - |
| `accruals_for_sale` | Начисления за продажу | НЕТ | UE: точная выручка per операция |
| `sale_commission` | Комиссия продажи | ДА | - |
| `amount` | Итого к перечислению | ДА (через services) | - |
| `type` | Тип начисления | НЕТ | Группировка |
| **posting.delivery_schema** | FBO/FBS/RFBS/Crossborder | ДА (FBO/FBS) | RFBS отдельно? |
| **posting.order_date** | Дата заказа | **НЕТ** | **CRITICAL: order-settlement связка** |
| **posting.posting_number** | Номер отправления | **НЕТ** | **CRITICAL: связка с orders** |
| **posting.warehouse_id** | ID склада | НЕТ | Аналитика по складам |
| `items[].name` | Название товара | НЕТ | Резерв |
| `items[].sku` | SKU товара | ДА | - |
| **items[].quantity** | Количество единиц | ДА (для settled_qty) | - |
| `services[].name` | Название услуги | ДА (классификация) | - |
| `services[].price` | Цена услуги | ДА | - |

### Известные operation_type (используемые)
| operation_type | Описание | Наша обработка |
|----------------|----------|----------------|
| `OperationAgentDeliveredToCustomer` | Доставка покупателю | commission + logistics + settled_qty |
| `OperationItemReturn` | Возврат | logistics |
| `MarketplaceRedistributionOfAcquiringOperation` | Эквайринг | acquiring |
| `OperationMarketplaceServiceStorage` | Хранение | storage |
| `OperationMarketplaceServicePremiumCashbackIndividualPoints` | Кэшбек/бонусы | promotion |
| `StarsMembership` | Звёздные товары | other |

### Неиспользуемые operation_type (потенциально важные)
| operation_type | Описание | Импакт |
|----------------|----------|--------|
| `OperationCorrectionSeller` | Корректировка продавцу | Влияет на payout |
| `OperationDefectiveWriteOff` | Списание бракованного товара | Потери |
| `OperationLackWriteOff` | Списание недостачи | Потери |
| `OperationMarketplaceServicePremiumPromotion` | Платное продвижение МП | Реклама? |
| `MarketplaceSellerReexposureDeliveryReturnOperation` | Повторная выставка | Логистика |
| `ClientReturnAgentOperation` | Возврат через агента | Возвраты |
| `OperationMarketplaceServiceStockDisposal` | Утилизация на складе | Потери |

### CRITICAL: Неиспользуемые поля
1. **`posting.order_date`** — Дата заказа внутри каждой финансовой транзакции. Позволяет связать settlement с order date без дополнительных API-вызовов. **Уже задокументировано в ozon-audit-2026-02-20.md, Phase 2 план.**
2. **`posting.posting_number`** — Связка с Posting API. Позволяет match order с settlement.
3. **`accruals_for_sale`** — Выручка за конкретную продажу (до вычета комиссий). Может быть точнее, чем считать из services.

### Ограничения API
- **Макс. период: 1 месяц** (наш код обрезает до 30 дней в sync_costs_ozon:1787)
- **page_size: max 1000** (мы используем 1000)
- **Safety limit: 20 страниц** (наш код, sync_service.py:1805)
- Даты в UTC

---

## 2. POST /v1/analytics/data

**Наш файл:** `backend/app/services/ozon_client.py:331-350`
**Используется в:** `sync_sales_ozon()` (sync_service.py:687)

### Что мы отправляем
```json
{
  "date_from": "2026-01-22",
  "date_to": "2026-02-21",
  "dimension": ["sku", "day"],
  "metrics": ["ordered_units", "revenue", "returns", "session_view", "hits_tocart"],
  "limit": 1000,
  "offset": 0
}
```

### Доступные параметры
| Параметр | Тип | Описание | Мы используем? |
|----------|-----|----------|----------------|
| `date_from` / `date_to` | date | Период | ДА |
| `dimension` | string[] | Разбивка | ДА (["sku", "day"]) |
| `metrics` | string[] | Метрики | ДА (5 из ~20+) |
| `limit` | int | Лимит (max 1000) | ДА (1000) |
| `offset` | int | Смещение | ДА (0, **без пагинации**) |
| `sort` | object[] | Сортировка | НЕТ |
| `filters` | object[] | Фильтры по SKU/бренду | НЕТ |

### Доступные dimensions
| Dimension | Описание | Мы используем? |
|-----------|----------|----------------|
| `sku` | По SKU | ДА |
| `spu` | По SPU (карточка) | НЕТ |
| `day` | По дням | ДА |
| `week` | По неделям | НЕТ |
| `month` | По месяцам | НЕТ |
| `year` | По годам | НЕТ |
| `category1` / `category2` / `category3` / `category4` | По категориям | НЕТ (потенциал для аналитики) |
| `brand` | По брендам | НЕТ |
| `modelID` | По модели | НЕТ |

### Все доступные metrics
| Метрика | Описание | Мы используем? | Потенциал |
|---------|----------|----------------|-----------|
| `ordered_units` | Заказанные единицы | ДА | - |
| `revenue` | Выручка (заказы) | ДА | - |
| `returns` | Возвраты (штуки) | ДА | - |
| `session_view` | Просмотры сессий | ДА (сохраняем, не используем) | Конверсия воронки |
| `hits_tocart` | Добавления в корзину | ДА | - |
| **`hits_view`** | Просмотры карточки | НЕТ (в параметрах OzonClient, не в sync) | Воронка: views→cart→order |
| **`hits_view_search`** | Просмотры из поиска | НЕТ | SEO-аналитика |
| **`hits_view_pdp`** | Просмотры из PDP | НЕТ | UX-аналитика |
| **`session_view_search`** | Сессии из поиска | НЕТ | SEO |
| **`session_view_pdp`** | Сессии из PDP | НЕТ | UX |
| **`conv_tocart_search`** | CR в корзину из поиска | НЕТ | CR аналитика |
| **`conv_tocart_pdp`** | CR в корзину из PDP | НЕТ | CR аналитика |
| **`delivered_units`** | Доставленные единицы | НЕТ | **Реальные выкупы vs заказы** |
| **`adv_view_pdp`** | Показы из рекламы | НЕТ | Ad attribution |
| **`adv_view_search_category`** | Показы в категории из рекл. | НЕТ | Ad attribution |
| **`adv_view_all`** | Все рекламные показы | НЕТ | Ad attribution |
| **`adv_sum_all`** | Сумма рекламных расходов | НЕТ | Альтернатива Performance API |
| **`position_category`** | Позиция в категории | НЕТ | SEO мониторинг |
| **`cancellations`** | Отмены | НЕТ | Качество заказов |
| **`returns_FBO_units`** | Возвраты FBO | НЕТ | **FBO/FBS разбивка!** |
| **`returns_FBS_units`** | Возвраты FBS | НЕТ | **FBO/FBS разбивка!** |

### CRITICAL: Проблемы
1. **БЕЗ ПАГИНАЦИИ** (P2 из аудита 20.02.2026) — `limit: 1000, offset: 0`. При >1000 SKU-дней данные теряются. Нужен цикл с offset.
2. **fulfillment_type всегда FBO** — Analytics API не предоставляет FBO/FBS разбивку для `ordered_units` и `revenue`. Но **`returns_FBO_units` и `returns_FBS_units` ЕСТЬ** — можно хотя бы возвраты разбить.
3. **`delivered_units`** не используется — это реальные выкупы, а не заказы. Может дать более точный `buyout_percent`.
4. **session_view** сохраняется в mp_sales, но нигде не отображается на UI.

### Ограничения API
- **Макс. период: ~92 дня** (3 месяца)
- **limit: max 1000** строк в ответе
- **Данные: дата ЗАКАЗА** (НЕ settlement)
- Обновление: данные за вчера появляются с задержкой 1-2 дня

---

## 3. POST /v4/product/info/stocks

**Наш файл:** `backend/app/services/ozon_client.py:108-260`
**Используется в:** `sync_stocks_ozon()` (sync_service.py:1069)

### Что мы отправляем
```json
{
  "filter": {
    "visibility": "ALL",
    "product_id": [123, 456],
    "offer_id": ["barcode1", "barcode2"]
  },
  "limit": 1000,
  "last_id": ""
}
```

### Доступные параметры filter
| Параметр | Тип | Описание | Мы используем? |
|----------|-----|----------|----------------|
| `offer_id` | string[] | Фильтр по артикулу | ДА |
| `product_id` | int[] | Фильтр по ID товара | ДА |
| `visibility` | string | ALL/VISIBLE/INVISIBLE... | ДА ("ALL") |

### Поля ответа (per item)
| Поле | Описание | Мы используем? | Потенциал |
|------|----------|----------------|-----------|
| `product_id` | ID товара | ДА (маппинг) | - |
| `offer_id` | Артикул | ДА (маппинг) | - |
| `stocks[].type` | FBO/FBS/crossborder | ДА (суммируем) | **Разбивка FBO/FBS остатков** |
| `stocks[].present` | Всего на складе | ДА | - |
| `stocks[].reserved` | Зарезервировано | ДА (вычитаем) | Показ резерва отдельно |
| `stocks[].warehouse_name` | Название склада | ДА (если есть) | - |

### Формула наших остатков
```python
quantity = max(present - reserved, 0)
```

### ЗАМЕЧАНИЯ
- **Мультистратегия** (5 fallback вариантов) — хорошо, покрывает разные конфигурации аккаунтов
- **FBO fallback через `/v2/analytics/stock_on_warehouses`** — покрывает случай когда /v4 не отдает FBO
- **stocks[].type** содержит "fbo"/"fbs" — можно разбить остатки по fulfillment type (сейчас всё записывается как FBO)

---

## 4. POST /v3/product/list + POST /v3/product/info/list

**Наш файл:** `backend/app/services/ozon_client.py:43-61`
**Используется в:** `sync_products()`, `_fetch_all_ozon_products()`

### /v3/product/list — параметры
| Параметр | Тип | Описание | Мы используем? |
|----------|-----|----------|----------------|
| `filter.offer_id` | string[] | Фильтр по артикулу | НЕТ |
| `filter.product_id` | int[] | Фильтр по ID | НЕТ |
| `filter.visibility` | string | Видимость | НЕТ (но в test_api используем "ALL") |
| `limit` | int | Лимит (max 1000) | ДА (100) |
| `last_id` | string | Пагинация | ДА |

### /v3/product/info/list — поля ответа
| Поле | Описание | Мы используем? | Потенциал |
|------|----------|----------------|-----------|
| `id` (product_id) | ID товара | ДА | - |
| `name` | Название | ДА | - |
| `offer_id` | Артикул (наш barcode) | ДА | - |
| `barcode` | Штрихкод | ДА | - |
| `sku` / `fbo_sku` / `fbs_sku` | SKU по типу фулфилмента | ДА (для маппинга) | - |
| `sources[].sku` | Все SKU из разных источников | ДА (prefer fbo) | - |
| **`images`** | Ссылки на изображения | НЕТ | Отображение товара в UI |
| **`primary_image`** | Главное изображение | НЕТ | Карточка товара |
| **`category_id`** | ID категории | НЕТ | Группировка |
| **`color_image`** | Цвет/вариант | НЕТ | - |
| **`status`** | Статус модерации | НЕТ | Алерт при блокировке |
| **`visible`** | Видимость на сайте | НЕТ | Алерт при скрытии |
| **`price` / `old_price` / `marketing_price`** | Цены | НЕТ (отдельно в /v5) | - |
| **`sources[].source`** | Источник SKU (fbo/fbs/crossborder) | ДА (для маппинга) | - |
| **`stocks.coming`** | Товары в пути | НЕТ | **Прогноз остатков** |
| **`stocks.present`** | На складе | НЕТ | Быстрый stock check |
| **`stocks.reserved`** | Зарезервировано | НЕТ | - |

### /v5/product/info/prices — используется для cost_price
| Поле | Описание | Мы используем? |
|------|----------|----------------|
| `price` | Цена | НЕТ |
| `old_price` | Старая цена | НЕТ |
| `marketing_price` | Маркетинговая цена | НЕТ |
| **`cost_price`** | Себестоимость (вводится продавцом) | ДА (для purchase_price) |
| `min_price` | Минимальная цена | НЕТ |
| `commissions.sales_percent` | % комиссии | НЕТ |
| `commissions.fbo_fulfillment_amount` | Стоимость FBO фулфилмента | НЕТ |
| `commissions.fbs_fulfillment_amount` | Стоимость FBS фулфилмента | НЕТ |

### ЗАМЕЧАНИЕ
- **`commissions.sales_percent`** — Ozon отдает % комиссии. Можно использовать для прогнозной UE нового товара (до первой финансовой транзакции).
- **`commissions.fbo_fulfillment_amount`** / **`fbs_fulfillment_amount`** — базовые ставки фулфилмента для оценки затрат.
- **`stocks.coming`** — товары в пути на склад. Полезно для прогноза остатков.

---

## 5. POST /v3/posting/fbs/list

**Наш файл:** `backend/app/services/ozon_client.py:268-282`
**Используется в:** `sync_orders_ozon()` (sync_service.py:2500-2513)

### Что мы отправляем
```json
{
  "filter": {
    "since": "2026-01-22T00:00:00.000Z",
    "to": "2026-02-21T23:59:59.999Z"
  },
  "limit": 100,
  "offset": 0,
  "with": {
    "analytics_data": true,
    "financial_data": true
  }
}
```

### Доступные параметры filter
| Параметр | Тип | Описание | Мы используем? |
|----------|-----|----------|----------------|
| `since` / `to` | datetime | Период | ДА |
| `status` | string | Фильтр по статусу | НЕТ |
| `delivery_method_id` | int[] | Метод доставки | НЕТ |
| `provider_id` | int[] | ID провайдера | НЕТ |
| `warehouse_id` | int[] | ID склада | НЕТ |
| `order_id` | int | ID заказа | НЕТ |

### Доступные параметры "with"
| Параметр | Описание | Мы используем? |
|----------|----------|----------------|
| `analytics_data` | Аналитические данные (регион, склад) | ДА |
| `financial_data` | Финансовые данные (комиссии, выплаты) | ДА |
| **`barcodes`** | Штрихкоды товаров | НЕТ |
| **`translit`** | Транслит названий | НЕТ |

### Поля ответа (per posting)
| Поле | Описание | Мы используем? | Потенциал |
|------|----------|----------------|-----------|
| `posting_number` | Номер отправления | ДА | - |
| `status` | Статус | ДА (маппинг) | - |
| `in_process_at` | Дата начала обработки | ДА (order_date) | - |
| `shipment_date` | Дата отгрузки | ДА (last_change_date) | - |
| **`delivering_date`** | Дата доставки (ожидаемая) | НЕТ | SLA мониторинг |
| `products[].sku` | SKU товара | ДА | - |
| `products[].offer_id` | Артикул | ДА | - |
| `products[].quantity` | Количество | ДА | - |
| `products[].price` | Цена | ДА | - |
| **`products[].name`** | Название | НЕТ | UI |
| `analytics_data.region` | Регион доставки | ДА | - |
| `analytics_data.warehouse_name` | Склад | ДА | - |
| **`analytics_data.city`** | Город | НЕТ | Географическая аналитика |
| **`analytics_data.delivery_type`** | Тип доставки | НЕТ | Аналитика доставки |
| **`analytics_data.is_premium`** | Premium заказ | НЕТ | Аналитика клиентов |
| **`analytics_data.payment_type_group_name`** | Способ оплаты | НЕТ | Аналитика платежей |
| `financial_data.commission_amount` | Комиссия | ДА | - |
| `financial_data.payout` | Выплата | ДА | - |
| **`financial_data.products[].commission_amount`** | Per-product комиссия | ДА (FBO формат) | - |
| **`financial_data.products[].payout`** | Per-product выплата | ДА (FBO формат) | - |
| **`cancellation.cancel_reason`** | Причина отмены | НЕТ | Аналитика отмен |
| **`cancellation.cancel_reason_id`** | ID причины | НЕТ | - |
| **`cancellation.cancellation_type`** | Кто отменил | НЕТ | - |
| **`tracking_number`** | Трек-номер | НЕТ | - |
| **`tpl_integration_type`** | Тип интеграции ТПЛ | НЕТ | - |

### ЗАМЕЧАНИЯ
- **`analytics_data.city`** — не извлекаем, хотя доступен. Полезно для географии продаж.
- **`analytics_data.payment_type_group_name`** — тип оплаты. Полезно для анализа предоплата vs постоплата.
- **`cancellation`** — причины отмен не сохраняем. Полезно для product quality мониторинга.

---

## 6. POST /v2/posting/fbo/list

**Наш файл:** `backend/app/services/ozon_client.py:284-298`
**Используется в:** `sync_orders_ozon()` (sync_service.py:2515-2527)

### Что мы отправляем
```json
{
  "filter": {
    "since": "2026-01-22T00:00:00.000Z",
    "to": "2026-02-21T23:59:59.999Z"
  },
  "limit": 100,
  "offset": 0,
  "with": {
    "analytics_data": true,
    "financial_data": true
  }
}
```

### Отличия от FBS
- **Ответ: `result` = массив** (не `result.postings`)
- **`financial_data.products[]`** — per-product (не top-level)
- Нет `cancellation` блока (отмены через другой механизм)
- Статусы другие: `delivered` / `cancelled` / и т.д.

### Доступные, но неиспользуемые поля
| Поле | Описание | Потенциал |
|------|----------|-----------|
| **`analytics_data.city`** | Город | Географическая аналитика |
| **`analytics_data.delivery_type`** | Тип доставки | - |
| **`analytics_data.is_legal`** | Юрлицо ли покупатель | B2B аналитика |
| **`financial_data.cluster_from`** | Кластер отправки | Логистическая аналитика |
| **`financial_data.cluster_to`** | Кластер доставки | Логистическая аналитика |

---

## 7. Ozon Performance API (реклама)

**Наш файл:** `backend/app/services/ozon_client.py:353-515`
**Используется в:** `sync_ads_ozon()` (sync_service.py:2146)

### Эндпоинты
1. **POST /api/client/token** — OAuth2 авторизация (client_credentials)
2. **GET /api/client/campaign** — Список кампаний
3. **POST /api/client/statistics** — Запрос отчёта (async)
4. **GET /api/client/statistics/{UUID}** — Polling статуса отчёта
5. **GET {link}** — Скачивание CSV отчёта

### Из CSV извлекаем
| Поле CSV | Наше поле | Описание |
|----------|-----------|----------|
| col[0] | date | Дата (DD.MM.YYYY) |
| col[4] | views | Просмотры |
| col[5] | clicks | Клики |
| col[9] | expense | Расход (руб) |
| col[10] | orders | Заказы |

### Что мы НЕ извлекаем из CSV (потенциально полезные колонки)
| Индекс | Описание | Потенциал |
|--------|----------|-----------|
| col[1] | Охват | Уникальные пользователи |
| col[2] | Показы в корзине | Cart visibility |
| col[3] | Показы на карточке | PDP visibility |
| col[6] | CTR | Мы считаем сами |
| col[7] | Средний CPC | Мы считаем сами |
| col[8] | Расход (с НДС) | Расход с НДС |
| col[11] | Выручка от заказов | **Ad ROAS!** |
| col[12] | Модель оплаты | CPM/CPC/etc. |

### CRITICAL: Неизвлекаемые данные
1. **Выручка от заказов (col[11])** — позволяет считать ROAS = revenue/expense. Сейчас считаем DRR = ad_cost/total_revenue, что менее точно.
2. **Охват (col[1])** — уникальные пользователи vs показы. Важно для оценки частоты.
3. **product_id = None** для всех Ozon ads — кампании привязаны к аккаунту, не к товарам. Это ограничение API, не наш баг.

### Доступные, но неиспользуемые API методы Performance
| Метод | Описание | Потенциал |
|-------|----------|-----------|
| **GET /api/client/campaign/{id}** | Детали кампании | Бюджет, ставки, статус |
| **GET /api/client/campaign/{id}/objects** | Товары в кампании | Привязка ad → product |
| **PUT /api/client/campaign/{id}/bid** | Изменение ставки | Автоуправление |
| **GET /api/client/campaign/{id}/daily_budget** | Дневной бюджет | Мониторинг бюджета |
| **POST /api/client/statistics/json** | JSON-отчёт (альтернатива CSV) | Проще парсить |
| **GET /api/client/campaign/{id}/attribution** | Атрибуция | **Точная связка ad→order** |

### Альтернатива: /api/client/statistics/json
Вместо CSV, Performance API также поддерживает JSON формат ответа через endpoint `/api/client/statistics/json`. Это устраняет хрупкий CSV парсинг с позиционными индексами.

---

## 8. POST /v2/analytics/stock_on_warehouses

**Наш файл:** `backend/app/services/ozon_client.py:130-187`
**Используется в:** `sync_stocks_ozon()` как FBO fallback

### Параметры
```json
{
  "limit": 100,
  "offset": 0,
  "warehouse_type": "ALL"
}
```

### Поля ответа
| Поле | Описание | Мы используем? |
|------|----------|----------------|
| `sku` | SKU товара | ДА |
| `item_code` | Артикул (offer_id) | ДА |
| `item_name` | Название | НЕТ |
| `free_to_sell_amount` | Доступно к продаже | ДА (quantity) |
| `reserved_amount` | Зарезервировано | НЕТ |
| `promised_amount` | В пути от продавца | НЕТ |
| `warehouse_name` | Название склада | ДА |

### ЗАМЕЧАНИЕ
- **`promised_amount`** — товары в пути. Может быть полезно для прогноза пополнения.

---

## 9. DEPRECATION: 20.03.2026

### Список deprecated эндпоинтов и их замен

| Старый (v1) | Новый (v2) | Мы используем? |
|-------------|-----------|----------------|
| `/v1/product/info/stocks-by-warehouse/fbs` | `/v2/product/info/stocks-by-warehouse/fbs` | НЕТ |
| **`/v1/warehouse/list`** | **`/v2/warehouse/list`** | **ДА** (ozon_client.py:264) |
| `/v1/delivery-method/list` | `/v2/delivery-method/list` | НЕТ |
| `/v1/carriage/delivery/list` | `/v2/carriage/delivery/list` | НЕТ |
| `/v1/posting/carriage-available/list` | `/v2/carriage/delivery/list` | НЕТ |
| `/v2/posting/fbs/digital/act/check-status` | `/v2/posting/fbs/act/check-status` | НЕТ |
| `/v2/posting/fbs/digital/act/get-pdf` | `/v2/posting/fbs/act/get-pdf` | НЕТ |

### Анализ нашего использования

#### /v1/warehouse/list — ЗАТРОНУТЫ

**Файл:** `backend/app/services/ozon_client.py:262-264`
```python
async def get_warehouse_list(self) -> dict:
    """Получить список складов"""
    return await self._request("POST", "/v1/warehouse/list", json={})
```

**Статус:** Метод ОПРЕДЕЛЁН, но **НЕ ВЫЗЫВАЕТСЯ** нигде в production-коде. Grep по всей кодовой базе показывает только определение.

**Действие:** Низкий приоритет, но обновить на `/v2/warehouse/list` для консистентности. Если в будущем понадобится (например, для маппинга warehouse_id → warehouse_name), v1 уже не будет работать.

**Ожидаемые изменения v1 → v2:**
- `/v2/warehouse/list` принимает тот же формат запроса (пустой JSON body)
- Ответ может содержать дополнительные поля (например, `warehouse_type`, `status`)
- Основная структура `{result: [{warehouse_id, name, ...}]}` сохраняется

#### Все остальные deprecated эндпоинты — НЕ ЗАТРОНУТЫ
- `/v1/product/info/stocks-by-warehouse/fbs` — не используем (у нас `/v4/product/info/stocks`)
- `/v1/delivery-method/list` — не используем
- `/v1/carriage/delivery/list` — не используем
- `/v1/posting/carriage-available/list` — не используем
- `/v2/posting/fbs/digital/act/*` — не используем (FBS акты/PDF)

---

## 10. СВОДКА НАХОДОК

### CRITICAL (нужно исправить)

| # | Проблема | Файл | Описание |
|---|----------|------|----------|
| 1 | **Нет пагинации в analytics** | sync_service.py:697 | `limit: 1000, offset: 0` — при >1000 SKU-дней данные теряются |
| 2 | **posting.order_date игнорируется** | sync_service.py:1814 | Finance API отдает дату заказа, но мы её не сохраняем. Phase 2 план уже есть |
| 3 | **posting.posting_number не сохраняется** | sync_service.py:1813 | Нужен для связки order↔settlement |

### HIGH (улучшения аналитики)

| # | Проблема | Описание |
|---|----------|----------|
| 4 | `delivered_units` не используется | Реальные выкупы vs заказы — точнее buyout% |
| 5 | Ozon Ad Revenue (col[11]) не извлекается | Нужен для ROAS per campaign |
| 6 | `stocks[].type` не разделяется на FBO/FBS | Остатки Ozon всегда записываются как FBO |
| 7 | `returns_FBO_units` / `returns_FBS_units` не используются | Единственный способ FBO/FBS разбивки из Analytics API |
| 8 | `/v1/warehouse/list` deprecated 20.03.2026 | Обновить на v2 (хотя метод не вызывается в production) |

### MEDIUM (nice-to-have)

| # | Проблема | Описание |
|---|----------|----------|
| 9 | `analytics_data.city` не извлекается | Географическая аналитика |
| 10 | `cancellation.cancel_reason` не извлекается | Анализ причин отмен |
| 11 | `accruals_for_sale` не используется | Точная выручка per transaction |
| 12 | `session_view` сохраняется, но не отображается | Воронка продаж Ozon |
| 13 | Performance API JSON endpoint | `/api/client/statistics/json` вместо хрупкого CSV парсинга |
| 14 | `stocks.coming` / `promised_amount` | Товары в пути для прогноза |
| 15 | `commissions.sales_percent` из /v5 | Прогнозная UE до первого расчёта |
| 16 | `hits_view_search` / `position_category` | SEO мониторинг |

### LOW (backlog)

| # | Проблема | Описание |
|---|----------|----------|
| 17 | `operation_type_name` не используется | Человекочитаемые имена для UI |
| 18 | `analytics_data.is_premium` | Premium заказы |
| 19 | `analytics_data.payment_type_group_name` | Тип оплаты |
| 20 | `financial_data.cluster_from/to` | Логистическая аналитика |

---

## 11. ПОЛНАЯ КАРТА ИСПОЛЬЗУЕМЫХ OZON API ЭНДПОИНТОВ

```
Ozon Seller API (api-seller.ozon.ru)
├── Товары
│   ├── POST /v3/product/list              ← sync_products, _fetch_all_ozon_products
│   ├── POST /v3/product/info/list         ← sync_products (названия, SKU маппинг)
│   └── POST /v5/product/info/prices       ← sync_products (cost_price)
│
├── Остатки
│   ├── POST /v4/product/info/stocks       ← sync_stocks_ozon (основной, 4 стратегии)
│   ├── POST /v2/analytics/stock_on_warehouses ← sync_stocks_ozon (FBO fallback)
│   └── POST /v1/warehouse/list            ← ОПРЕДЕЛЁН но НЕ ВЫЗЫВАЕТСЯ ⚠️ DEPRECATED 20.03.2026
│
├── Аналитика
│   └── POST /v1/analytics/data            ← sync_sales_ozon (заказы, выручка, воронка)
│
├── Финансы
│   ├── POST /v3/finance/transaction/list  ← sync_costs_ozon (удержания, settlement)
│   └── POST /v1/finance/realization       ← ОПРЕДЕЛЁН но НЕ РАБОТАЕТ (404)
│
└── Отправления
    ├── POST /v3/posting/fbs/list          ← sync_orders_ozon (FBS заказы)
    └── POST /v2/posting/fbo/list          ← sync_orders_ozon (FBO заказы)

Ozon Performance API (api-performance.ozon.ru)
├── POST /api/client/token                 ← OAuth2 auth
├── GET  /api/client/campaign              ← sync_ads_ozon (список кампаний)
├── POST /api/client/statistics            ← sync_ads_ozon (запрос отчёта → UUID)
├── GET  /api/client/statistics/{UUID}     ← sync_ads_ozon (polling)
└── GET  {CSV link}                        ← sync_ads_ozon (скачивание данных)
```

---

## 12. РЕКОМЕНДАЦИИ ПО ПРИОРИТЕТУ

### Немедленно (до 20.03.2026)
1. **Обновить `/v1/warehouse/list` → `/v2/warehouse/list`** в ozon_client.py:264
   - Простое изменение пути, 1 строка
   - Хотя метод не используется, лучше обновить до deprecation deadline

### Следующий sprint
2. **Добавить пагинацию в sync_sales_ozon** — цикл с offset пока len(data) == limit
3. **Извлекать `delivered_units`** из Analytics API — для точного buyout%
4. **Разделить stocks по FBO/FBS** из `stocks[].type` в /v4 ответе
5. **Извлекать Ad Revenue (col[11])** из Performance CSV — для ROAS

### Phase 2 (уже запланировано)
6. **posting.order_date + posting.posting_number** — settlement-order связка
7. **`returns_FBO_units` + `returns_FBS_units`** — FBS breakdown для analytics

### Backlog
8. Performance API JSON endpoint вместо CSV
9. Географическая аналитика (city)
10. SEO метрики (hits_view_search, position_category)

---

## 13. ВАЖНО: Что НЕ нужно менять

Следующие эндпоинты стабильны и работают корректно:
- `/v3/finance/transaction/list` — основа нашего costs-tree, верифицирован (diff=0.00₽ с ЛК)
- `/v4/product/info/stocks` — мультистратегия работает надёжно
- `/v3/posting/fbs/list` + `/v2/posting/fbo/list` — FBS/FBO разбивка работает
- `/v5/product/info/prices` — cost_price извлекается корректно
- Performance API async workflow — работает (CSV парсинг хрупок, но стабилен)
