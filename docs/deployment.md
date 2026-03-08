# Deployment Guide — Analytics Dashboard

> Версия: 1.0 | Обновлено: 18.02.2026
> Production: `https://reviomp.ru`

---

## Содержание

1. [Обзор инфраструктуры](#1-обзор-инфраструктуры)
2. [VPS настройка](#2-vps-настройка)
3. [Backend деплой](#3-backend-деплой)
4. [Frontend деплой](#4-frontend-деплой)
5. [Nginx конфигурация](#5-nginx-конфигурация)
6. [Полный процесс деплоя (чеклист)](#6-полный-процесс-деплоя-чеклист)
7. [Cron задачи](#7-cron-задачи)
8. [Миграции БД](#8-миграции-бд)
9. [SSL сертификат](#9-ssl-сертификат)
10. [Мониторинг и логи](#10-мониторинг-и-логи)
11. [Откат](#11-откат)
12. [Переменные окружения](#12-переменные-окружения)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Обзор инфраструктуры

```
                          +------------------+
                          |   Пользователь   |
                          +--------+---------+
                                   |
                              HTTPS (443)
                                   |
                          +--------v---------+
                          |      Nginx       |
                          |  (reverse proxy) |
                          |  Let's Encrypt   |
                          +---+-----------+--+
                              |           |
                    /api/*    |           |  /*  (статика)
                              |           |
                   +----------v--+   +----v-----------------+
                   |   Uvicorn   |   |  frontend/dist/      |
                   |  FastAPI    |   |  (SPA: React + Vite) |
                   |  :8000      |   +----------------------+
                   +------+------+
                          |
                    HTTPS (remote)
                          |
                   +------v------+        +----------------+
                   |  Supabase   |        |     Cron       |
                   |  Cloud DB   |        |  */30 min      |
                   |  (PostgreSQL|        |  sync queue    |
                   |   + RLS)    |        +----------------+
                   +-------------+

VPS: Ubuntu 24.04 (Beget)
Stack: Python 3.14 + FastAPI | React 19 + TS 5.9 + Vite 7 + Tailwind 3
БД: Supabase Cloud (PostgreSQL + Row Level Security)
```

---

## 2. VPS настройка

### Системные требования

| Параметр       | Значение                              |
|----------------|---------------------------------------|
| ОС             | Ubuntu 24.04 LTS                      |
| Python         | 3.14+                                 |
| Node.js        | 22+ LTS (для сборки frontend)         |
| Nginx          | 1.24+                                 |
| Certbot        | Let's Encrypt                         |
| Память         | 1 ядро, 1+ GB RAM                     |

### Структура каталогов на VPS

```
/var/www/analytics/
├── .env                          # Переменные окружения (единый файл)
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI entrypoint
│   │   ├── config.py             # Pydantic Settings (.env)
│   │   ├── auth.py               # JWT JWKS verification
│   │   ├── crypto.py             # Fernet encryption
│   │   ├── plans.py              # Тарифные планы (в коде, НЕ в БД)
│   │   ├── subscription.py       # Subscription dependency
│   │   ├── api/v1/               # Роутеры API
│   │   │   ├── dashboard.py      # Дашборд, UE, stocks, costs-tree
│   │   │   ├── sync.py           # Синхронизация WB/Ozon
│   │   │   ├── sync_queue.py     # Очередь sync (cron)
│   │   │   ├── products.py       # Управление товарами
│   │   │   ├── sales_plan.py     # План продаж (3 уровня)
│   │   │   ├── export.py         # PDF export (Playwright)
│   │   │   ├── payment.py        # YooKassa webhook
│   │   │   ├── tokens.py         # API-токены маркетплейсов
│   │   │   ├── subscription.py   # Тарифы
│   │   │   ├── account.py        # Профиль, удаление аккаунта
│   │   │   └── admin.py          # Админ-эндпоинты
│   │   ├── services/
│   │   │   └── sync_service.py   # Логика sync WB + Ozon
│   │   ├── models/               # Pydantic модели
│   │   └── db/                   # Supabase client
│   ├── requirements.txt
│   ├── migrations/               # SQL миграции (001..017)
│   ├── scripts/                  # Утилиты (reconstruct_stock_history.py)
│   └── venv/                     # Python virtual environment (НЕ деплоится)
└── frontend/                     # Только dist/ (собранная статика)
    ├── index.html
    ├── assets/
    │   ├── index-XXXXX.js
    │   └── index-XXXXX.css
    └── ...
```

### Первоначальная настройка VPS

```bash
# 1. Обновление системы
apt update && apt upgrade -y

# 2. Python 3.14 (если не установлен)
apt install -y python3.14 python3.14-venv python3-pip

# 3. Node.js 22 LTS (для локальной сборки — на VPS не обязателен)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 4. Nginx
apt install -y nginx

# 5. Certbot (SSL)
apt install -y certbot python3-certbot-nginx

# 6. Утилиты
apt install -y rsync curl jq

# 7. Создание структуры
mkdir -p /var/www/analytics/backend
mkdir -p /var/www/analytics/frontend

# 8. Virtual environment
cd /var/www/analytics/backend
python3.14 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 9. Playwright (для PDF export)
playwright install chromium
playwright install-deps
```

---

## 3. Backend деплой

### Systemd unit файл

Файл: `/etc/systemd/system/analytics-api.service`

```ini
[Unit]
Description=Analytics Dashboard API (FastAPI + Uvicorn)
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/var/www/analytics/backend
Environment=PATH=/var/www/analytics/backend/venv/bin:/usr/local/bin:/usr/bin
ExecStart=/var/www/analytics/backend/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --log-level info
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> **Примечание:** `--workers 4` — 4 воркера на 1 ядро (I/O-bound, CPU idle 95% времени). RAM: ~200MB. Потолок: ~60 concurrent users.

### Управление сервисом

```bash
# Включить автозапуск
systemctl enable analytics-api

# Запуск / остановка / перезапуск
systemctl start analytics-api
systemctl stop analytics-api
systemctl restart analytics-api

# Статус
systemctl status analytics-api

# Применение изменений в unit файле
systemctl daemon-reload
systemctl restart analytics-api
```

### Обновление зависимостей

```bash
cd /var/www/analytics/backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart analytics-api
```

---

## 4. Frontend деплой

Frontend собирается **локально** (или на CI), затем `dist/` копируется на VPS.

### Локальная сборка

```bash
cd frontend

# Проверка компиляции (ОБЯЗАТЕЛЬНО перед деплоем)
npm run build
# Эквивалентно: tsc -b && vite build

# Результат: frontend/dist/
```

> **ВАЖНО:** Никогда не используйте `npm run dev` для проверки. Только `npm run build`.

### Копирование на VPS

```bash
# rsync: быстрая синхронизация с удалением устаревших файлов
rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    frontend/dist/ \
    root@<VPS_IP>:/var/www/analytics/frontend/
```

Флаг `--delete` удаляет файлы на VPS, которых нет в локальном `dist/` (старые хэшированные бандлы).

---

## 5. Nginx конфигурация

Файл: `/etc/nginx/sites-available/analytics`

```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN>;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <YOUR_DOMAIN>;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/<YOUR_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<YOUR_DOMAIN>/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;

    # API — proxy pass к FastAPI (Uvicorn)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Таймауты для длинных sync/export операций
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
    }

    # Health check (корневой, без /api prefix)
    location = /health {
        proxy_pass http://127.0.0.1:8000/health;
    }

    # YooKassa webhook (прямой путь)
    location /api/v1/payment/webhook {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Статика frontend (Vite build)
    location / {
        root /var/www/analytics/frontend;
        index index.html;

        # SPA fallback: все маршруты → index.html
        try_files $uri $uri/ /index.html;

        # Кэширование статических ассетов (хэшированные имена — long cache)
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # index.html — без кэша (для обновлений SPA)
        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires 0;
        }
    }

    # Лимит размера загрузки (для API)
    client_max_body_size 10M;
}
```

### Активация конфигурации

```bash
# Симлинк в sites-enabled
ln -sf /etc/nginx/sites-available/analytics /etc/nginx/sites-enabled/analytics

# Удалить дефолтный конфиг (если есть)
rm -f /etc/nginx/sites-enabled/default

# Проверить синтаксис
nginx -t

# Перезагрузить
systemctl reload nginx
```

---

## 6. Полный процесс деплоя (чеклист)

Пошаговая инструкция для стандартного деплоя. Выполняется из корня проекта на локальной машине.

### Шаг 1. Сборка frontend

```bash
cd frontend && npm run build
```

Если сборка завершилась с ошибками -- **СТОП**. Исправить ошибки TypeScript/Vite перед продолжением.

### Шаг 2. Проверить изменения

```bash
git status
git diff --stat
```

Убедиться, что нет незакоммиченных секретов, лишних файлов, ломающих изменений.

### Шаг 3. Проверить миграции

Если есть **новые SQL миграции** в `backend/migrations/` -- применить их в Supabase Dashboard (SQL Editor) **ДО деплоя backend**. Подробнее: [Миграции БД](#8-миграции-бд).

### Шаг 4. Деплой frontend

```bash
rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    frontend/dist/ \
    root@<VPS_IP>:/var/www/analytics/frontend/
```

### Шаг 5. Деплой backend (если изменился)

```bash
rsync -avz \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='.env' \
    -e "ssh -o StrictHostKeyChecking=no" \
    backend/ \
    root@<VPS_IP>:/var/www/analytics/backend/
```

> **ВАЖНО:** `.env` исключается из rsync. Переменные окружения управляются отдельно на VPS.

### Шаг 6. Обновить зависимости (если requirements.txt изменился)

```bash
ssh root@<VPS_IP> "cd /var/www/analytics/backend && source venv/bin/activate && pip install -r requirements.txt"
```

### Шаг 7. Перезапустить backend

```bash
ssh root@<VPS_IP> "systemctl restart analytics-api"
```

### Шаг 8. Верификация

```bash
# Health check API
curl -s https://<YOUR_DOMAIN>/api/v1/health
# Ожидаемый ответ: {"status":"ok"}

# Проверить HTTP-код главной страницы
curl -s -o /dev/null -w "%{http_code}" https://<YOUR_DOMAIN>
# Ожидаемый ответ: 200

# Логи backend (последние 20 строк)
ssh root@<VPS_IP> "journalctl -u analytics-api --no-pager -n 20"
```

### Экспресс-деплой (одна команда)

Для автоматизации можно использовать Claude Code skill `/deploy`, который выполняет все шаги автоматически с проверками на каждом этапе.

---

## 7. Cron задачи

### Sync Queue (обработка очереди синхронизации)

Каждые 30 минут cron вызывает endpoint обработки очереди. Очередь содержит пользователей с разными расписаниями по тарифам (Free/Pro/Business).

Файл: `/etc/crontab` (или `crontab -e` от root)

```cron
# Sync queue — каждые 30 минут
*/30 * * * * root curl -s -X POST \
    -H "X-Cron-Secret: <SYNC_CRON_SECRET>" \
    https://<YOUR_DOMAIN>/api/v1/sync/process-queue \
    >> /var/log/analytics-sync.log 2>&1
```

### Certbot auto-renewal

```cron
# SSL renewal — дважды в день (certbot пропускает, если сертификат не истекает)
0 3,15 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

### Проверка cron

```bash
# Список задач
crontab -l

# Лог sync
tail -f /var/log/analytics-sync.log

# Ручной вызов sync (для диагностики)
curl -s -X POST \
    -H "X-Cron-Secret: <SYNC_CRON_SECRET>" \
    https://<YOUR_DOMAIN>/api/v1/sync/process-queue
```

### Расписание синхронизации по тарифам

| Тариф    | Автоматическая sync (MSK)   | Ручная sync      |
|----------|-----------------------------|-------------------|
| Free     | 08:00, 20:00                | 0 раз/день        |
| Pro      | +1ч к Business расписанию   | 1 раз/день        |
| Business | 06:00, 12:00, 18:00, 00:00  | 2 раза/день       |

---

## 8. Миграции БД

### Supabase Cloud

БД управляется через Supabase Cloud (PostgreSQL). Миграции применяются вручную через **Supabase Dashboard > SQL Editor**.

### Список миграций

```
backend/migrations/
├── 001_initial.sql                  # Таблицы mp_sales, mp_stocks, mp_ads, products
├── 002_optimized_rpc.sql            # RPC-функции для costs-tree
├── 003_all_rpc_functions.sql        # Все RPC (dashboard, UE)
├── 004_add_user_id.sql              # user_id во все таблицы (multi-tenant)
├── 005_rls_policies.sql             # Row Level Security
├── 006_rpc_with_user_id.sql         # RPC с фильтром user_id
├── 007_user_tokens.sql              # mp_user_tokens (Fernet encrypted)
├── 008_subscriptions.sql            # Подписки, планы
├── 009_add_ozon_sku.sql             # OZON SKU поле
├── 010_sync_queue.sql               # mp_sync_queue + mp_sync_log
├── 011_orders.sql                   # mp_orders (позаказная детализация)
├── 012_payments.sql                 # Платежи YooKassa
├── 013_product_management.sql       # Группы товаров, порядок, custom costs
├── 014_sales_plan.sql               # mp_sales_plan (per-product)
├── 015_sales_plan_marketplace.sql   # Колонка marketplace в mp_sales_plan
├── 016_sales_plan_summary.sql       # mp_sales_plan_summary (total/MP level)
├── 017_stock_snapshots.sql          # mp_stock_snapshots (история остатков)
├── 018_fbs_fulfillment_type.sql     # fulfillment_type (FBO/FBS) в 6 таблицах
├── 019_settled_qty.sql              # settled_qty для Ozon UE
├── 020_fix_rpc_purchase_axis.sql    # Fix: order-based purchase для ВСЕХ МП
├── 021_user_dashboard_config.sql    # Dashboard widget configuration
├── 032_storage_costs_daily.sql      # Per-product daily storage costs
├── 036_ue_ozon_delivered_fix.sql    # RPC get_ozon_ue_delivered
├── 037_composite_indexes.sql        # Composite indexes (user_id, marketplace, date)
└── FULL_SCHEMA_NEW_PROJECT.sql      # Полная схема для нового проекта
```

### Порядок применения

1. Миграции применяются **строго последовательно** (001 --> 002 --> ... --> 017)
2. Каждая миграция идемпотентна (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`)
3. Перед применением -- **прочитать SQL**, убедиться в отсутствии destructive операций
4. После применения -- проверить в Supabase Dashboard: Table Editor

### Новый проект (с нуля)

Для развертывания с нуля используйте `FULL_SCHEMA_NEW_PROJECT.sql` -- он содержит полную схему, включая все таблицы, RPC-функции и RLS-политики.

### Процесс применения миграции

```
1. Открыть Supabase Dashboard > SQL Editor
2. Скопировать содержимое миграции (напр. 017_stock_snapshots.sql)
3. Нажать "Run" (F5)
4. Убедиться: "Success. No rows returned" (для DDL)
5. Проверить в Table Editor, что таблица/колонка создана
6. Задеплоить backend (который использует новую структуру)
```

> **ВАЖНО:** Миграции применяются **ДО** деплоя backend, иначе backend упадет при обращении к несуществующим таблицам/колонкам.

---

## 9. SSL сертификат

### Первоначальная выдача

```bash
certbot --nginx -d <YOUR_DOMAIN>
```

Certbot автоматически:
- Получит сертификат Let's Encrypt
- Обновит конфигурацию Nginx
- Настроит редирект HTTP --> HTTPS

### Продление

```bash
# Ручное продление
certbot renew

# Проверить дату истечения
certbot certificates

# Тест renewal (без реального продления)
certbot renew --dry-run
```

### Автоматическое продление

Cron-задача (см. [Cron задачи](#7-cron-задачи)):

```cron
0 3,15 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

Сертификаты Let's Encrypt действуют 90 дней. Certbot продлевает за 30 дней до истечения.

---

## 10. Мониторинг и логи

### Backend (FastAPI / Uvicorn)

```bash
# Реалтайм логи
journalctl -u analytics-api -f

# Последние 100 строк
journalctl -u analytics-api --no-pager -n 100

# Логи за сегодня
journalctl -u analytics-api --since today

# Логи за конкретный период
journalctl -u analytics-api --since "2026-02-18 10:00" --until "2026-02-18 12:00"

# Только ошибки
journalctl -u analytics-api -p err --no-pager -n 50
```

### Nginx

```bash
# Access log (все запросы)
tail -f /var/log/nginx/access.log

# Error log (ошибки)
tail -f /var/log/nginx/error.log

# Поиск 5xx ошибок
grep " 50[0-9] " /var/log/nginx/access.log | tail -20
```

### Sync лог

```bash
# Лог cron sync
tail -f /var/log/analytics-sync.log

# В Supabase: таблица mp_sync_log
# Содержит: user_id, marketplace, status, started_at, completed_at, error
```

### Health check

```bash
# API health
curl -s https://<YOUR_DOMAIN>/api/v1/health
# {"status":"ok"}

# HTTP status код
curl -s -o /dev/null -w "%{http_code}" https://<YOUR_DOMAIN>
# 200
```

### Supabase мониторинг

- **Supabase Dashboard > Logs:** логи БД-запросов, auth, realtime
- **Supabase Dashboard > Database > Query Performance:** медленные запросы
- **Supabase Dashboard > Auth > Users:** зарегистрированные пользователи

### Статус сервисов

```bash
# Все связанные сервисы
systemctl status analytics-api
systemctl status nginx

# Используемые порты
ss -tlnp | grep -E '(8000|80|443)'
```

---

## 11. Откат

### Быстрый откат через Git

```bash
# 1. Найти последний рабочий коммит
git log --oneline -10

# 2. Откатить к конкретному коммиту
git revert <commit_hash>
# или: git checkout <commit_hash> -- frontend/src/ backend/app/

# 3. Пересобрать и задеплоить
cd frontend && npm run build
# Затем rsync + systemctl restart (шаги 4-7 из чеклиста)
```

### Откат backend на VPS (если нет доступа к git)

```bash
# На VPS: проверить что сломалось
ssh root@<VPS_IP>
systemctl status analytics-api
journalctl -u analytics-api --no-pager -n 50

# Перезапуск (если зависло)
systemctl restart analytics-api

# Если .env повреждён — восстановить из бэкапа
```

### Откат миграции БД

Миграции Supabase необратимы через CLI. Для отката:

1. Написать обратную миграцию (DROP TABLE / ALTER TABLE DROP COLUMN)
2. Применить в Supabase SQL Editor
3. Убедиться, что backend-код совместим с откаченной схемой

> **Рекомендация:** Всегда делать бэкап перед деструктивными миграциями через Supabase Dashboard > Database > Backups.

### Диагностика при сбое

```bash
# 1. Backend не стартует?
systemctl status analytics-api
journalctl -u analytics-api --no-pager -n 50

# 2. Nginx возвращает ошибку?
nginx -t                          # Проверить конфиг
tail -20 /var/log/nginx/error.log

# 3. Frontend пустой экран?
ls -la /var/www/analytics/frontend/  # Файлы на месте?
curl -I https://<YOUR_DOMAIN>        # Что отдает Nginx?
```

---

## 12. Переменные окружения

Файл: `/var/www/analytics/.env`

> **ВАЖНО:** Файл `.env` содержит секреты и **НИКОГДА** не коммитится в git. Не передается через rsync при деплое. Редактируется напрямую на VPS.

| Переменная                       | Описание                                                        | Обязательна |
|----------------------------------|-----------------------------------------------------------------|:-----------:|
| `WB_API_TOKEN`                   | API-токен Wildberries (legacy; пользователи хранят свои через Fernet) | Да* |
| `OZON_CLIENT_ID`                 | Client ID Ozon Seller API (legacy)                              | Да* |
| `OZON_API_KEY`                   | API Key Ozon Seller API (legacy)                                | Да* |
| `OZON_PERFORMANCE_CLIENT_ID`     | Client ID Ozon Performance API (реклама)                        | Да* |
| `OZON_PERFORMANCE_CLIENT_SECRET` | Client Secret Ozon Performance API                              | Да* |
| `SUPABASE_URL`                   | URL Supabase проекта (`https://xxx.supabase.co`)                | Да  |
| `SUPABASE_ANON_KEY`              | Supabase anon (public) key                                      | Да  |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase service role key (полный доступ, обход RLS)            | Да  |
| `SYNC_CRON_SECRET`               | Секрет для аутентификации cron-запросов (`X-Cron-Secret` header)| Да  |
| `FERNET_KEY`                     | Ключ шифрования Fernet для API-токенов пользователей            | Да  |
| `YOOKASSA_SHOP_ID`               | ID магазина YooKassa                                            | Да  |
| `YOOKASSA_SECRET_KEY`            | Секретный ключ YooKassa                                         | Да  |
| `DEBUG`                          | Режим отладки (`true`/`false`). Production: `false`             | Нет |
| `FRONTEND_URL`                   | URL фронтенда для PDF export (`https://<YOUR_DOMAIN>`)          | Нет |
| `ADMIN_USER_IDS`                 | UUID администраторов (JSON-массив)                              | Нет |

> *Пометка "Да*": legacy-переменные для обратной совместимости. В SaaS-режиме каждый пользователь хранит свои API-токены зашифрованными через Fernet.

### Пример .env

```env
# Wildberries (legacy admin tokens)
WB_API_TOKEN=<your_wb_token>

# Ozon Seller API
OZON_CLIENT_ID=<your_ozon_client_id>
OZON_API_KEY=<your_ozon_api_key>

# Ozon Performance API
OZON_PERFORMANCE_CLIENT_ID=<your_ozon_perf_client_id>
OZON_PERFORMANCE_CLIENT_SECRET=<your_ozon_perf_secret>

# Supabase
SUPABASE_URL=https://<project_ref>.supabase.co
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Security
SYNC_CRON_SECRET=<random_secret_string>
FERNET_KEY=<fernet_key_base64>

# YooKassa
YOOKASSA_SHOP_ID=<shop_id>
YOOKASSA_SECRET_KEY=<secret_key>

# App
DEBUG=false
FRONTEND_URL=https://<YOUR_DOMAIN>
ADMIN_USER_IDS=["<admin_uuid>"]
```

### Генерация Fernet Key

```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

---

## 13. Troubleshooting

### Backend не стартует

```
Симптом: systemctl status analytics-api → "failed" или "activating"
```

| Проверка                          | Команда                                          |
|-----------------------------------|--------------------------------------------------|
| Логи ошибки                       | `journalctl -u analytics-api --no-pager -n 50`  |
| .env существует и корректен       | `cat /var/www/analytics/.env` (проверить формат) |
| venv активируется                 | `source /var/www/analytics/backend/venv/bin/activate && python -c "import fastapi"` |
| Порт 8000 свободен                | `ss -tlnp \| grep 8000`                          |
| Зависимости установлены           | `pip install -r requirements.txt`                |
| Python версия                     | `python3 --version` (3.14+)                      |

### 502 Bad Gateway

```
Симптом: Nginx возвращает 502 при обращении к /api/*
```

Причина: Uvicorn не запущен или упал.

```bash
# 1. Проверить статус
systemctl status analytics-api

# 2. Если не запущен — запустить
systemctl restart analytics-api

# 3. Если падает с ошибкой — смотреть логи
journalctl -u analytics-api --no-pager -n 50

# 4. Проверить, что порт слушается
ss -tlnp | grep 8000
```

### CORS ошибки в браузере

```
Симптом: "Access to XMLHttpRequest... has been blocked by CORS policy"
```

1. Проверить `FRONTEND_URL` в `.env` -- должен совпадать с URL, откуда идут запросы
2. Проверить `allow_origins` в `backend/app/main.py` -- домен должен быть в списке
3. Убедиться, что Nginx не дублирует CORS-заголовки (двойной `Access-Control-Allow-Origin`)

### Sync не работает

```
Симптом: Данные не обновляются автоматически
```

```bash
# 1. Проверить cron задачу
crontab -l | grep sync

# 2. Проверить лог
tail -20 /var/log/analytics-sync.log

# 3. Ручной вызов
curl -v -X POST \
    -H "X-Cron-Secret: <SYNC_CRON_SECRET>" \
    https://<YOUR_DOMAIN>/api/v1/sync/process-queue

# 4. Проверить sync_log в Supabase Dashboard
# Таблица mp_sync_log: последние записи, status, error
```

### Frontend показывает белый экран

```
Симптом: Страница загружается, но пустая (SPA не рендерится)
```

```bash
# 1. Проверить, что файлы на месте
ls -la /var/www/analytics/frontend/

# 2. Проверить index.html
head -5 /var/www/analytics/frontend/index.html

# 3. Проверить, что assets (JS/CSS) доступны
curl -I https://<YOUR_DOMAIN>/assets/index-*.js

# 4. Открыть DevTools → Console → посмотреть JS-ошибки
# Часто причина: неправильный API URL или отсутствие .env на frontend
```

### PDF Export не работает

```
Симптом: Ошибка при экспорте в PDF
```

```bash
# 1. Playwright установлен?
ssh root@<VPS_IP>
source /var/www/analytics/backend/venv/bin/activate
playwright install chromium
playwright install-deps

# 2. FRONTEND_URL корректен?
grep FRONTEND_URL /var/www/analytics/.env
# Должен быть: https://<YOUR_DOMAIN>

# 3. Chromium может запуститься?
python -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); b = p.chromium.launch(); b.close(); p.stop(); print('OK')"
```

### Supabase: Connection refused / timeout

```
Симптом: Backend не может подключиться к Supabase
```

1. Проверить `SUPABASE_URL` и ключи в `.env`
2. Убедиться, что Supabase проект не на паузе (Supabase Dashboard)
3. Проверить DNS: `nslookup <project_ref>.supabase.co`
4. Проверить исходящие соединения с VPS: `curl -s https://<project_ref>.supabase.co/rest/v1/ -H "apikey: <anon_key>"`

### Память / диск на VPS

```bash
# Свободная память
free -h

# Дисковое пространство
df -h

# Самые большие файлы
du -sh /var/www/analytics/* | sort -rh

# Очистить старые логи
journalctl --vacuum-time=7d
```

---

## Приложение: Полезные команды

```bash
# === Статус системы ===
systemctl status analytics-api nginx
ss -tlnp | grep -E '(80|443|8000)'

# === Быстрая диагностика ===
curl -s https://<YOUR_DOMAIN>/api/v1/health | jq .
journalctl -u analytics-api --no-pager -n 20

# === Перезапуск всего ===
systemctl restart analytics-api
systemctl reload nginx

# === Логи в реальном времени ===
journalctl -u analytics-api -f

# === Дисковое пространство ===
df -h /var/www/analytics/
du -sh /var/www/analytics/backend/venv/

# === Процессы Python ===
ps aux | grep uvicorn
```
