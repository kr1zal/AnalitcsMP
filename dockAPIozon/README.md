# Ozon Seller API — Официальная документация

> Скопировано вручную с https://docs.ozon.ru/api/seller/
> Дата: 2026-02-26

## Структура файлов

| Файл | Endpoint | Приоритет | Зачем нам |
|------|----------|-----------|-----------|
| `1_fbs_posting_list.md` | POST `/v3/posting/fbs/list` | **P0** | Заказы FBS → mp_orders |
| `2_fbo_posting_list.md` | POST `/v2/posting/fbo/list` | **P0** | Заказы FBO → mp_orders |
| `3_finance_transaction_list.md` | POST `/v3/finance/transaction/list` | **P0** | Удержания → mp_costs |
| `4_analytics_data.md` | POST `/v1/analytics/data` | **P1** | Продажи → mp_sales |
| `5.md` | POST `/v1/report/placement/by-products/create` | **P0** | Per-product storage costs → UE |
| `6.md` | POST `/v1/report/info` | **P0** | Статус отчёта + URL скачивания |
| `7_ozon_ue_order_date.md` | — (внутренняя документация) | **P0** | order_date fix: UE совпадение с ЛК |

## Как копировать с docs.ozon.ru

1. Открой страницу эндпоинта
2. Ctrl+A → Ctrl+C всю страницу (или только секции Request/Response)
3. Вставь в соответствующий .md файл
4. НЕ нужно форматировать — Claude разберёт raw копию

## Что НЕ нужно копировать
- Дерево категорий (`/v1/description-category/*`) — не используем
- Контент (`/v2/product/info/description`) — не используем
- Промо/акции (`/v1/actions/*`) — не используем
- Чат (`/v1/chat/*`) — не используем
- Сертификаты — не используем
