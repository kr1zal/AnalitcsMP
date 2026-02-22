Ручная синхронизация данных с маркетплейсов.

Аргумент $ARGUMENTS может содержать: marketplace (wb/ozon/all), user email или JWT токен.

## Шаг 1: Определи параметры

Нужно знать:
- **JWT токен** — если не указан, попроси:
  ```
  DevTools (F12) → Console:
  JSON.parse(localStorage.getItem('sb-xpushkwswfbkdkbmghux-auth-token')).access_token
  ```
- **Маркетплейс** — wb, ozon или all (по умолчанию: all)

Для admin (cron) синхронизации JWT не нужен:
```bash
curl -s -X POST "http://localhost:8000/api/v1/admin/sync/USER_ID" \
  -H "X-Cron-Secret: analytics-cron-s3cr3t-2026"
```

Admin user_id: e2db2023-4ce3-4182-96d3-7a194657cb4a

## Шаг 2: Проверь текущий статус синхронизации

```bash
curl -s -H "Authorization: Bearer JWT_TOKEN" \
  "http://localhost:8000/api/v1/sync/status" | python3 -m json.tool
```

## Шаг 3: Запусти ручную синхронизацию

### Через user endpoint (нужен JWT):
```bash
curl -s -X POST -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"marketplace": "MARKETPLACE"}' \
  "http://localhost:8000/api/v1/sync/manual" | python3 -m json.tool
```

### Через admin endpoint (нужен cron secret):
```bash
curl -s -X POST \
  -H "X-Cron-Secret: analytics-cron-s3cr3t-2026" \
  "http://localhost:8000/api/v1/admin/sync/e2db2023-4ce3-4182-96d3-7a194657cb4a" | python3 -m json.tool
```

## Шаг 4: Мониторь прогресс

Подожди 10-30 секунд и проверь статус:
```bash
curl -s -H "Authorization: Bearer JWT_TOKEN" \
  "http://localhost:8000/api/v1/sync/status" | python3 -m json.tool
```

## Шаг 5: Отчёт

```
=== SYNC REPORT ===
Маркетплейс: WB / Ozon / All
Статус: ✓ Успешно / ✗ Ошибка
Время: X секунд
Данные: sales (N записей), stocks (N), costs (N), ads (N)
Следующая авто-синхронизация: DATETIME
```

Если ошибка — покажи логи: `journalctl -u analytics-api --no-pager -n 20`
