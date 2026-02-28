# Ozon Seller API -- Документация для проекта

> Скопировано вручную с https://docs.ozon.ru/api/seller/
> Последнее обновление: 28.02.2026

## Структура файлов

| Файл | Endpoint | Приоритет | Зачем нам | Ключевые поля |
|------|----------|-----------|-----------|---------------|
| `1.md` | `POST /v3/posting/fbs/unfulfilled/list` | **P0** | Заказы FBS (необработанные) -> mp_orders | posting_number, status, products[].sku, price, quantity |
| `2.md` | `POST /v2/posting/fbo/list` | **P0** | Заказы FBO -> mp_orders | posting_number, status, products[].sku, financial_data, order_id |
| `3.md` | `POST /v3/finance/transaction/list` | **P0** | Удержания -> mp_costs | posting.delivery_schema, operation_type, accruals_for_sale, services[] |
| `4.md` | `POST /v1/analytics/data` | **P1** | Продажи -> mp_sales | metrics[revenue, ordered_units], dimensions[sku, day] |
| `5.md` | `POST /v1/report/placement/by-products/create` | **P0** | Per-product storage costs -> UE | date_from, date_to, code (UUID) |
| `6.md` | `POST /v1/report/info` | **P0** | Статус отчёта + URL скачивания | code, status, file (URL) |
| `7_ozon_ue_order_date.md` | -- (внутренняя документация) | **P0** | UE: order_date + storage + delivery_date — полное совпадение с ЛК | Phase 1 (order_date), Phase 2 (delivery_date) |
| `8.md` | `POST /v3/posting/fbs/list` | **P2** | FBS отправления (исследование) | posting_number, status, delivery_method, in_process_at |
| `9.md` | `POST /v2/posting/fbo/list` | **P2** | FBO отправления (дубль для исследования) | posting_number, status, financial_data, created_at |
| `10.md` | `POST /v2/posting/fbo/get` | **P2** | FBO детали отправления (fact_delivery_date) | posting_number, fact_delivery_date, financial_data |
| `11.md` | `POST /v3/posting/fbs/get` | **P2** | FBS детали отправления (fact_delivery_date) | posting_number, fact_delivery_date, delivery_method |
| `12.md` | `POST /v1/report/postings/create` | **P0** | CSV Postings Report → delivery_date | posting_number, delivery_date, status, SKU, quantity |

## Использование в проекте

| Файл | Где используется |
|------|-----------------|
| 1.md | `backend/app/services/sync_service.py` (sync_orders_ozon) |
| 2.md | `backend/app/services/sync_service.py` (sync_orders_ozon) |
| 3.md | `backend/app/services/sync_service.py` (sync_costs_ozon) |
| 4.md | `backend/app/services/sync_service.py` (sync_sales_ozon) |
| 5.md | `backend/app/services/sync_service.py` (sync_storage_ozon) |
| 6.md | `backend/app/services/ozon_client.py` (get_report_info) — используется для 5.md и 12.md |
| 7_ozon_ue_order_date.md | Внутренняя документация (UE: order_date fix + delivery_date filter) |
| 8.md | Исследование, пока не используется |
| 9.md | Исследование, пока не используется |
| 10.md | Исследование (fact_delivery_date) |
| 11.md | Исследование (fact_delivery_date) |
| 12.md | `backend/app/services/ozon_client.py` (create_postings_report), `sync_service.py` (sync_delivery_dates_ozon) |

## Миграции (связанные)

| # | Файл | Endpoint | Назначение |
|---|------|----------|-----------|
| 030 | `030_order_date.sql` | 3.md | `order_date` в mp_costs_details |
| 031 | `031_storage_costs.sql` | 5.md | `mp_storage_costs` (legacy) |
| 032 | `032_storage_costs_daily.sql` | 5.md | `mp_storage_costs_daily` (daily per-product) |
| 033 | `033_delivery_date.sql` | 12.md | `delivery_date` в mp_orders + throttle |
| 034 | `034_mp_orders_quantity.sql` | -- | `quantity INT` в mp_orders (DATA-001) |
| 035 | `035_scale_fixes.sql` | -- | SUPERSEDED by 035b |
| 035b | `035b_scale_fixes_v2.sql` | -- | `posting_number` idx + 2 RPC (batch_update, get_ozon_ue_delivered) |

## Как копировать с docs.ozon.ru

1. Открой страницу эндпоинта
2. Ctrl+A -> Ctrl+C всю страницу (или только секции Request/Response)
3. Вставь в соответствующий .md файл
4. НЕ нужно форматировать -- Claude разберёт raw копию

## Что НЕ нужно копировать
- Дерево категорий (`/v1/description-category/*`) -- не используем
- Контент (`/v2/product/info/description`) -- не используем
- Промо/акции (`/v1/actions/*`) -- не используем
- Чат (`/v1/chat/*`) -- не используем
- Сертификаты -- не используем
