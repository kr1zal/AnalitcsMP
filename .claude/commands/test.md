Тестирование API endpoints — проверка что всё работает.

Аргумент $ARGUMENTS: "local" (localhost:8000) или "prod" (reviomp.ru). По умолчанию: local.

## Определи base URL

- local → `http://localhost:8000/api/v1`
- prod → `https://reviomp.ru/api/v1`

## Тесты (выполняй параллельно где возможно)

### 1. Health check (без авторизации)
```bash
curl -s -o /dev/null -w "%{http_code}" BASE_URL/../docs
```
Ожидание: 200

### 2. Auth check — endpoint должен требовать JWT
```bash
curl -s BASE_URL/dashboard/summary | python3 -c "import sys,json; d=json.load(sys.stdin); print('AUTH OK' if 'Authorization' in d.get('detail','') else 'WARN: no auth')"
```
Ожидание: 401 с "Authorization header required"

### 3. Costs-tree endpoints (с cron auth для admin)
```bash
# WB
curl -s -H "X-Cron-Secret: analytics-cron-s3cr3t-2026" -H "X-Cron-User-Id: e2db2023-4ce3-4182-96d3-7a194657cb4a" \
  "BASE_URL/dashboard/costs-tree?date_from=2026-01-16&date_to=2026-02-15&marketplace=wb" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'WB tree: {len(d.get(\"tree\",[]))} items, total_accrued={d.get(\"total_accrued\",0)}')"

# Ozon
curl -s -H "X-Cron-Secret: analytics-cron-s3cr3t-2026" -H "X-Cron-User-Id: e2db2023-4ce3-4182-96d3-7a194657cb4a" \
  "BASE_URL/dashboard/costs-tree?date_from=2026-01-16&date_to=2026-02-15&marketplace=ozon" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Ozon tree: {len(d.get(\"tree\",[]))} items, total_accrued={d.get(\"total_accrued\",0)}')"
```
Ожидание: 200, tree не пустой

### 4. Summary endpoint
```bash
curl -s -H "X-Cron-Secret: analytics-cron-s3cr3t-2026" -H "X-Cron-User-Id: e2db2023-4ce3-4182-96d3-7a194657cb4a" \
  "BASE_URL/dashboard/summary?date_from=2026-01-16&date_to=2026-02-15" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Revenue={d.get(\"revenue\",0)}, Orders={d.get(\"orders_count\",0)}')"
```

### 5. Stocks endpoint
```bash
curl -s -H "X-Cron-Secret: analytics-cron-s3cr3t-2026" -H "X-Cron-User-Id: e2db2023-4ce3-4182-96d3-7a194657cb4a" \
  "BASE_URL/dashboard/stocks" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Stocks: {len(d)} products')"
```

### 6. Products endpoint
```bash
curl -s -H "X-Cron-Secret: analytics-cron-s3cr3t-2026" -H "X-Cron-User-Id: e2db2023-4ce3-4182-96d3-7a194657cb4a" \
  "BASE_URL/products" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Products: {len(d)} items')"
```

### 7. Subscription endpoint
```bash
curl -s -H "X-Cron-Secret: analytics-cron-s3cr3t-2026" -H "X-Cron-User-Id: e2db2023-4ce3-4182-96d3-7a194657cb4a" \
  "BASE_URL/subscription" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Plan={d.get(\"plan\",\"?\")}, Status={d.get(\"status\",\"?\")}')"
```

## Отчёт

```
=== API TEST REPORT (local/prod) ===
| Endpoint          | Status | Result              |
|-------------------|--------|---------------------|
| Swagger docs      | ✓ 200  | OK                  |
| Auth guard        | ✓ 401  | Protected           |
| WB costs-tree     | ✓ 200  | 12 items, 7435₽    |
| Ozon costs-tree   | ✓ 200  | 8 items, 10539₽    |
| Summary           | ✓ 200  | Revenue=18909₽     |
| Stocks            | ✓ 200  | 5 products          |
| Products          | ✓ 200  | 6 items             |
| Subscription      | ✓ 200  | Pro, active         |

Результат: ✓ ALL PASSED (7/7) / ✗ FAILED (описание)
```

ВАЖНО: Для production тестов НЕ мутировать данные (только GET запросы).
