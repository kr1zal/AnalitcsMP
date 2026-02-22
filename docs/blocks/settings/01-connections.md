# Подключения (ConnectionsTab)

> Управление API-токенами маркетплейсов, валидация, шифрование (Fernet), синхронизация данных и SyncingOverlay.

**Правила CLAUDE.md:** #6, #7, #29

## Визуальная структура

```
/settings?tab=connections
+-----------------------------------------------------------------------+
| Настройки                                                             |
| +------------------+ +----------------------------------------------+|
| | [Подключения]    | |  [Onboarding Banner] (если нет токенов)      ||
| |  Товары          | |                                              ||
| |  План продаж     | |  +---- Wildberries ----+ [Подключен/Не указан]|
| |  Тариф           | |  | API Token  [*****]  [eye]                 ||
| |  Профиль         | |  | [Проверить]                               ||
| |                  | |  | > Где взять токен WB?                     ||
| | (vertical md+)   | |  +-------------------------+                 ||
| | (pills mobile)   | |                                              ||
| |                  | |  +---- Ozon Seller -----+ [Подключен/Не указан]
| |                  | |  | Client ID  [______]                       ||
| |                  | |  | API Key    [*****]  [eye]                  ||
| |                  | |  | [Проверить]                               ||
| |                  | |  +-------------------------+                 ||
| |                  | |                                              ||
| |                  | |  +---- Ozon Performance -+ [Подключен/Не указан]
| |                  | |  | Client ID  [______]                       ||
| |                  | |  | Client Secret [*****]  [eye]              ||
| |                  | |  | [Проверить]                               ||
| |                  | |  +-------------------------+                 ||
| |                  | |                                              ||
| |                  | |  [Сохранить]  [Сохранить и синхронизировать]  ||
| |                  | |                                              ||
| |                  | |  +---- Статус синхронизации ----+            ||
| |                  | |  | Тариф: Pro — каждые 6ч       |            ||
| |                  | |  | Последнее: 14:30 (2ч назад)   |            ||
| |                  | |  | Следующее: 20:30              |            ||
| |                  | |  +------------------------------+            ||
| |                  | |                                              ||
| |                  | |  +---- Ручное обновление ------+            ||
| |                  | |  | [Обновить сейчас] Осталось: 1/1          ||
| |                  | |  +------------------------------+            ||
| |                  | |                                              ||
| |                  | |  v История синхронизации (collapsible)       ||
| +------------------+ +----------------------------------------------+|
+-----------------------------------------------------------------------+

SyncingOverlay (full-screen, z-50):
+-----------------------------------------------------------------------+
|                                                                       |
|                    [Database icon, pulse]                              |
|               Загружаем ваши данные...                                |
|     Собираем продажи, заказы, издержки и рекламу                      |
|                                                                       |
|     [==============================         ] 72%                     |
|     Прошло: 1 мин 23 сек                                             |
|                                                                       |
|     Не закрывайте страницу                                            |
+-----------------------------------------------------------------------+
          |  (poll /sync/status каждые 5с)
          v
+-----------------------------------------------------------------------+
|                    [CheckCircle, green]                                |
|               Данные готовы!                                          |
|     [Перейти к отчётам ->]                                            |
+-----------------------------------------------------------------------+
```

## Файлы

| Компонент | Путь | Props / Exports |
|-----------|------|-----------------|
| SettingsPage | `frontend/src/pages/SettingsPage.tsx` | `SettingsPage` (110 строк, tab controller) |
| SettingsTabs | `frontend/src/components/Settings/SettingsTabs.tsx` | `{ activeTab: SettingsTabId, onChange }` |
| ConnectionsTab | `frontend/src/components/Settings/ConnectionsTab.tsx` | `{ isOnboarding: boolean, onStartSync: (startedAt: number) => void }` |
| SyncingOverlay | `frontend/src/components/Settings/SyncingOverlay.tsx` | `{ active: boolean, startedAt: number, onDone, onNavigate }` |
| SecretInput | `frontend/src/components/Settings/SecretInput.tsx` | `{ id, label, value, onChange, placeholder }` |
| StatusBadge | `frontend/src/components/Settings/StatusBadge.tsx` | `{ connected: boolean }` |
| useTokensStatus | `frontend/src/hooks/useTokens.ts` | Hook (staleTime: 10min) |
| useSaveTokens | `frontend/src/hooks/useTokens.ts` | Mutation, invalidates `['tokens']` |
| useValidateTokens | `frontend/src/hooks/useTokens.ts` | Mutation |
| useSaveAndSync | `frontend/src/hooks/useTokens.ts` | Mutation, invalidates `['tokens', 'dashboard', 'sync-logs']` |
| useSyncStatus | `frontend/src/hooks/useSync.ts` | Hook (refetchInterval: 30s, staleTime: 10s) |
| useManualSync | `frontend/src/hooks/useSync.ts` | Mutation, invalidates `['dashboard', 'sync']` |
| tokensApi | `frontend/src/services/api.ts` (строки 389-409) | `getStatus`, `save`, `validate`, `saveAndSync` |
| syncApi | `frontend/src/services/api.ts` (строки 444-530) | `syncAll`, `getLogs`, `getStatus`, `manualSync` |
| tokens.py | `backend/app/api/v1/tokens.py` | Router: GET/PUT/POST /tokens |
| sync.py | `backend/app/api/v1/sync.py` | Router: POST /sync/* , GET /sync/logs |
| sync_queue.py | `backend/app/api/v1/sync_queue.py` | Router: POST /sync/manual, /sync/process-queue, GET /sync/status |
| crypto.py | `backend/app/crypto.py` | `encrypt_token()`, `decrypt_token()` |

## Data Flow

### Токены: ввод -> валидация -> сохранение

```
ConnectionsTab (form state: wbToken, ozonClientId, ...)
  |
  ├── [Проверить] → useValidateTokens.mutateAsync(input)
  |     └─ API: tokensApi.validate(tokens)
  |          └─ POST /api/v1/tokens/validate
  |               └─ Backend: tokens.py → validate_tokens()
  |                    ├─ WildberriesClient.get_cards_by_barcode(["0000..."])
  |                    ├─ OzonClient.get_product_list(limit=1)
  |                    └─ OzonPerformanceClient.get_campaigns()
  |
  ├── [Сохранить] → useSaveTokens.mutateAsync(tokens)
  |     └─ API: tokensApi.save(tokens)
  |          └─ PUT /api/v1/tokens
  |               └─ Backend: tokens.py → save_tokens()
  |                    └─ encrypt_token() → UPSERT mp_user_tokens
  |
  └── [Сохранить и синхронизировать] → useSaveAndSync.mutateAsync(tokens)
        └─ API: tokensApi.saveAndSync(tokens)
             └─ POST /api/v1/tokens/save-and-sync
                  └─ Backend: tokens.py → save_tokens_and_sync()
                       ├─ 1. save_tokens() — шифрование + UPSERT
                       ├─ 2. INSERT mp_sync_log (status='running')
                       └─ 3. background_tasks.add_task(_run_sync)
                            └─ SyncService.sync_all(days_back=30)
```

### Статус синхронизации

```
ConnectionsTab
  └─ useSyncStatus()
       queryKey: ['sync', 'status']
       refetchInterval: 30000 (30 сек)
       staleTime: 10000 (10 сек)
       └─ API: syncApi.getStatus()
            └─ GET /api/v1/sync/status
                 └─ Backend: sync_queue.py → get_sync_status()
                      ├─ _ensure_queue_row() — lazy-create mp_sync_queue
                      ├─ _reset_daily_counter_if_needed()
                      ├─ last successful sync from mp_sync_log
                      └─ _is_sync_running() — check running lock (TTL 2h)
```

### SyncingOverlay: polling

```
SyncingOverlay (active=true)
  ├─ useEffect → setPhase('syncing')
  ├─ 5с задержка, затем poll каждые 5с:
  |     └─ syncApi.getStatus() → if (!is_syncing) → setPhase('done')
  |          └─ queryClient.invalidateQueries(['tokens', 'dashboard', 'sync'])
  └─ phase='done' → SyncDoneScreen → [Перейти к отчётам] → navigate('/')
```

### Ручное обновление

```
ConnectionsTab → [Обновить сейчас]
  └─ useManualSync.mutate()
       └─ API: syncApi.manualSync()
            └─ POST /api/v1/sync/manual (timeout: 300000ms / 5 мин)
                 └─ Backend: sync_queue.py → manual_sync()
                      ├─ Проверка лимита: plan.manual_sync_limit
                      ├─ Проверка running lock: _is_sync_running()
                      ├─ Инкремент: manual_syncs_today + 1
                      └─ _run_full_sync(trigger='manual')
                           └─ SyncService.sync_all(days_back=30)
```

### История синхронизации

```
ConnectionsTab → logsOpen=true
  └─ useQuery(['sync-logs'], refetchInterval: 5000)
       └─ API: syncApi.getLogs(20)
            └─ GET /api/v1/sync/logs?limit=20
                 └─ Backend: sync.py → get_sync_logs()
                      └─ SELECT * FROM mp_sync_log WHERE user_id=... ORDER BY finished_at DESC
```

## Архитектура Enterprise Settings (правило #29)

### SettingsPage как tab controller

SettingsPage (110 строк) — минимальный контроллер:

1. **URL state:** `useSearchParams()` читает `?tab=connections` (строки 22-27). Валидация: `VALID_TABS` массив.
   При изменении таба — `setSearchParams({ tab }, { replace: true })` (строка 41).
2. **Payment redirect:** если `?payment=` присутствует, автоматический переход на `tab=billing` (строки 30-36).
3. **Onboarding:** `location.state.onboarding === true` передаётся из Auth flow (строка 23).
4. **SyncingOverlay:** state поднят в SettingsPage (`syncActive`, `syncStartedAt`), overlay рендерится поверх всего (строка 82-87).
5. **Tab content:** условный рендеринг `activeTab === 'connections' && <ConnectionsTab />` (строки 98-105).
6. **F5 recovery:** при монтировании проверяет `syncApi.getStatus()` — если `is_syncing`, восстанавливает overlay (строки 63-78).

### SettingsTabs — навигация

- **Desktop (md+):** vertical sidebar, `min-w-[180px]`, `role="tablist"` (строки 32-56)
- **Mobile:** horizontal scroll pills, `overflow-x-auto`, `rounded-full` кнопки (строки 59-83)
- 5 табов: Подключения (Link2), Товары (Package), План продаж (Target), Тариф (CreditCard), Профиль (User)
- ARIA: `role="tab"`, `aria-selected`, `aria-controls="panel-{id}"`

### Redirect `/sync` -> `/settings?tab=connections`

Старый маршрут `/sync` удалён. SyncPage удалён. Весь функционал перенесён в ConnectionsTab.

## Backend логика

### Шифрование токенов (правило #7)

Файл: `backend/app/crypto.py` (26 строк)

```python
# Fernet symmetric encryption
def encrypt_token(plaintext: str) -> str:
    return Fernet(key).encrypt(plaintext.encode()).decode()

def decrypt_token(ciphertext: str) -> str:
    return Fernet(key).decrypt(ciphertext.encode()).decode()
```

- Ключ: `FERNET_KEY` из `.env` -> `config.py`
- Хранение: зашифрованные строки в `mp_user_tokens` (Supabase)
- Расшифровка: только на backend при создании API-клиентов (SyncService)

### POST /tokens/validate (tokens.py, строки 88-131)

1. Создаёт клиент маркетплейса с RAW-токеном (не шифрует)
2. Выполняет лёгкий API-запрос:
   - WB: `get_cards_by_barcode(["0000000000000"])` — 404 = валидный токен
   - Ozon Seller: `get_product_list(limit=1)`
   - Ozon Performance: `get_campaigns()`
3. Возвращает `{ results: { wb: { valid: true }, ozon_seller: { ... }, ozon_perf: { ... } } }`

### PUT /tokens (tokens.py, строки 62-83)

1. Только заполненные поля обновляются (пустые пропускаются)
2. `encrypt_token()` перед записью
3. `UPSERT mp_user_tokens ON CONFLICT (user_id)`

### POST /tokens/save-and-sync (tokens.py, строки 136-189)

1. Вызывает `save_tokens()` — шифрование + UPSERT
2. Создаёт запись `mp_sync_log` со `status='running'` — `is_syncing` сразу `true`
3. `background_tasks.add_task(_run_sync)` — FastAPI BackgroundTasks
4. Фоновая задача: `SyncService.sync_all(days_back=30)`, по завершении обновляет лог

### POST /sync/manual (sync_queue.py, строки 275-348)

1. Проверка `manual_sync_limit` из плана (Free=0, Pro=1, Business=2)
2. Lazy-create `mp_sync_queue` строки
3. Ежедневный сброс счётчика `manual_syncs_today` по МСК-полуночи
4. Проверка running lock (TTL 2 часа)
5. Инкремент счётчика + `_run_full_sync(trigger='manual')`

### POST /sync/process-queue (sync_queue.py, строки 175-268)

Cron-only endpoint (X-Cron-Secret header, вызов каждые 30 мин):
1. Выбирает пользователей с `next_sync_at <= now`
2. Сортировка по `priority` (plan-based) и `next_sync_at`
3. Пропускает: нет токенов, уже запущена синхронизация
4. Выполняет `_run_full_sync(trigger='auto')` последовательно
5. Обновляет `next_sync_at` для следующего цикла

### GET /sync/status (sync_queue.py, строки 355-417)

Возвращает:
- `plan`, `plan_name` — текущий тариф
- `last_sync_at`, `last_sync_ago_minutes` — последнее успешное
- `next_sync_at` — следующее автоматическое
- `sync_interval_hours` — интервал из плана
- `manual_syncs_today`, `manual_sync_limit`, `manual_syncs_remaining`
- `is_syncing` — есть ли running lock (TTL 2h)

### GET /sync/logs (sync.py, строки 395-424)

- `SELECT * FROM mp_sync_log WHERE user_id=... ORDER BY finished_at DESC LIMIT {limit}`
- Поля лога: `id, marketplace, sync_type, status, records_count, error_message, started_at, finished_at, trigger`

## SyncingOverlay — фазы

Файл: `frontend/src/components/Settings/SyncingOverlay.tsx` (182 строки)

Тип: `SyncPhase = 'idle' | 'syncing' | 'done'`

| Фаза | UI | Логика |
|------|-----|--------|
| `idle` | Скрыт (`return null`) | `active=false && phase='idle'` |
| `syncing` | Full-screen white, Database icon (pulse), прогресс-бар, таймер | Poll `syncApi.getStatus()` каждые 5с (с начальной задержкой 5с) |
| `done` | Full-screen white, CheckCircle green, кнопка "Перейти к отчётам" | `queryClient.invalidateQueries(['tokens', 'dashboard', 'sync'])` |

### SyncProgressBar (логарифмическая кривая)

```
p = min(92, 15 * log(elapsed/10 + 1) + elapsed * 0.15)
```

- Максимум 92% (не доходит до 100% пока sync не завершён)
- Обновление каждые 500мс
- Градиент: `from-indigo-500 via-indigo-600 to-violet-500`

### Переход done -> dashboard

`onNavigate` в SettingsPage: `setSyncActive(false)` + `navigate('/', { replace: true })`

## Состояние и кэширование

- **React Query keys:**
  - `['tokens', 'status']` — staleTime: 10min
  - `['sync', 'status']` — staleTime: 10s, refetchInterval: 30s
  - `['sync-logs']` — refetchInterval: 5s (внутри ConnectionsTab)
- **Zustand:** не используется (состояние формы — локальный useState)
- **Invalidation при save-and-sync:** `['tokens', 'dashboard', 'sync-logs']`
- **Invalidation при manual sync:** `['dashboard', 'sync']`
- **Invalidation после завершения overlay:** `['tokens', 'dashboard', 'sync']`

## Компоненты-примитивы

### SecretInput

Файл: `frontend/src/components/Settings/SecretInput.tsx` (40 строк)

Маскированный ввод с toggle видимости:
- `type={show ? 'text' : 'password'}`
- Кнопка Eye/EyeOff (`tabIndex={-1}`, не перехватывает фокус)
- `aria-label` для accessibility

### StatusBadge

Файл: `frontend/src/components/Settings/StatusBadge.tsx` (17 строк)

Два состояния:
- `connected=true`: зелёный badge "Подключен" + CheckCircle
- `connected=false`: серый badge "Не указан"

### HintBlock

Встроен в ConnectionsTab (строки 50-71). Collapsible подсказка "Где взять токен?":
- WB: seller.wildberries.ru -> Профиль -> Настройки -> Доступ к API
- Ozon Seller: seller.ozon.ru -> Настройки -> API ключи
- Ozon Performance: performance.ozon.ru -> Приложения -> Создать

## Edge Cases

1. **F5 во время синхронизации** — SettingsPage при монтировании проверяет `syncApi.getStatus()`, если `is_syncing=true` восстанавливает overlay (строки 63-78)
2. **Нет токенов** — показывается onboarding banner с инструкцией (строки 221-231)
3. **Лимит ручных обновлений исчерпан** — кнопка "Обновить сейчас" disabled, текст "Лимит исчерпан"
4. **Free план** — блок "Ручное обновление" заменяется на Lock + "Доступно на тарифе Pro"
5. **Running lock (TTL 2h)** — backend возвращает 409 `sync_already_running`, frontend показывает toast
6. **Validation 404** — WB API возвращает 404 на несуществующий баркод = токен валиден (tokens.py, строки 107-109)
7. **Пустые поля** — кнопки "Сохранить" disabled, пока `hasAnyInput=false`
8. **Overlay polling timeout** — нет явного таймаута; если sync зависнет на >2ч, running lock истечёт и overlay перейдёт в done

## Зависимости

- **Зависит от:** SettingsPage (tab controller), useSearchParams (URL state), React Query (cache)
- **Используется в:** SettingsPage (единственный потребитель)
- **Feature gate:** нет (доступно всем пользователям). Ручная синхронизация ограничена тарифом
- **БД таблицы:** `mp_user_tokens`, `mp_sync_log`, `mp_sync_queue`

## API Endpoints (сводка)

| Метод | Endpoint | Назначение |
|-------|----------|------------|
| GET | `/tokens` | Статус токенов (есть/нет, без значений) |
| PUT | `/tokens` | Сохранить токены (Fernet encryption) |
| POST | `/tokens/validate` | Проверить токены лёгкими API-запросами |
| POST | `/tokens/save-and-sync` | Сохранить + запустить sync в background |
| GET | `/sync/status` | Статус: plan, last/next sync, manual remaining, is_syncing |
| POST | `/sync/manual` | Ручная синхронизация (лимит по тарифу) |
| GET | `/sync/logs` | История синхронизации (mp_sync_log) |
| POST | `/sync/process-queue` | Cron-only: обработка очереди пользователей |

## Известные проблемы

- [ ] Ozon Performance валидация может быть медленной (OAuth flow)
- [ ] Нет явного таймаута для SyncingOverlay — при зависании sync пользователь ждёт до истечения running lock (2ч)
