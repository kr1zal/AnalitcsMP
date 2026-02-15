Never run "npm run dev"
Use "npm run build" to check if code compiles or no. See results and fix code if it's needed
Пиши ответы на Русском
Read and follow coding standards: .claude/rules/coding-standards.md
# Analytics Dashboard — WB & Ozon

5 SKU (витамины/БАДы), SaaS, per-user auth. **Production:** https://reviomp.ru

| VPS | Beget 83.222.16.15, Ubuntu 24.04 | SSH: `ssh root@83.222.16.15` пароль: `@vnDBp5VCt2+` |
|-----|-----------------------------------|------------------------------------------------------|
| Структура | `/var/www/analytics/` | systemd `analytics-api`, Nginx, Let's Encrypt |
| Supabase | reviomp (xpushkwswfbkdkbmghux) | Admin: exklante@gmail.com / `e2db2023-4ce3-4182-96d3-7a194657cb4a` |

**Стек:** Python 3.14 + FastAPI | React 19 + TS 5.9 + Vite 7 + Tailwind 3 | Supabase (PostgreSQL + RLS) | React Query 5 + Zustand 5

## Deployed (подробности → [docs/phases-history.md](docs/phases-history.md))
- SaaS Phase 1-4: Auth+RLS, Onboarding, Subscriptions, Sync Queue
- Order Monitor v1 (воронка) + v2 (позаказная детализация)
- Landing Page + DataFlowV3 + MatrixRain
- YooKassa Payment (ShopID: 1273909)
- Auth Flow (signup, reset, delete)
- Product Management (drag&drop, groups, CC)
- UE Profit Fix + P1 (ДРР, прогноз остатков)
- СПП в Продажах (credits included)
- Прибыль per OZON/WB в карточках MarketplaceBreakdown

## Активные задачи
- [ ] Hide Business tier, SEO index.html, admin ID→config
- [ ] Возвраты + ДРР от заказов/выкупов
- [ ] План продаж (ручной ввод)
- [ ] Donut chart по категориям
- [ ] Улучшить PDF экспорт

## Архитектурные решения (НЕ МЕНЯТЬ — 20 правил)
1. **Costs-tree:** отдельные параллельные запросы per marketplace (НЕ combined)
2. **AccrualsCards:** данные через props из DashboardPage
3. **DateRangePicker:** `captionLayout="label"` (НЕ dropdown)
4. **Tailwind v3** (НЕ v4)
5. **PDF:** Playwright backend (НЕ html2canvas)
6. **Auth:** Hybrid — service_role_key backend + RLS safety net + JWT JWKS
7. **Шифрование:** Fernet backend (НЕ pgcrypto/Vault)
8. **Подписки:** планы в коде plans.py (НЕ в БД)
9. **Sync:** DB queue + cron (НЕ Celery — 1 ядро VPS)
10. **Прибыль:** пропорциональная коррекция закупки через costsTreeRatio
11. **Order Monitor v1:** из mp_sales, непроведённые из costs-tree RPC
12. **Order Monitor v2:** mp_orders, WB srid 3-step accumulate, Ozon FBS+FBO
13. **WB SPP:** sale_price = retail_price_withdisc_rub (после СПП)
14. **Landing Hero:** Canvas MatrixRain
15. **DataFlow PRO:** скрыт `SHOW_PRO = false` (НЕ удалён)
16. **Pricing:** всегда `grid-cols-2`
17. **Product Management:** 3-col, @dnd-kit, click modals (НЕ hover)
18. **UE Profit:** `profit_i = total_payout × (revenue_i / Σrevenue) - purchase×ratio - ad×ratio`
19. **СПП:** credits ВХОДЯТ в displayed_revenue. Ratio = ЧИСТЫЕ sales (без credits)
20. **WB Методология:** ВЕРИФИЦИРОВАНА (аудит 15.02.2026). Двойного учёта СПП нет. Подробности → docs/phases-history.md

## Формулы (КРИТИЧНО)
```
profit = total_payout - purchase×costsTreeRatio - ads×costsTreeRatio
costsTreeRatio = costs_tree_SALES / mp_sales_revenue  (БЕЗ credits!)
displayed_revenue = costs_tree_sales + credits (СПП, возмещения)
UE: profit_i = total_payout × (revenue_i / Σrevenue) - purchase_i×ratio - ad_i×ratio
DRR = ad_cost / revenue × 100%
Stock forecast: days_remaining = quantity / avg_daily_sales(30d)
Per-MP profit: profit_mp = payout_mp - purchase×share - ad×share (share=pureSales_mp/totalPureSales)
WB Начислено = total_accrued = SUM(all tree items) = Продажи + Credits + Удержания
WB Продажи_display = pure_sales + credits (СПП/возмещения)
```

## Источники данных
- `mp_sales.revenue` — все заказы (вкл. непроведённые)
- `costs_tree "Продажи"` — финализированные из финотчёта
- Плашка "Продажи" = costs_tree_sales + credits
- WB credits = положительные tree items кроме "Продажи"

## Локальная разработка
```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev  # port 5173. НИКОГДА npm run dev для ПРОВЕРКИ — только npm run build
```

## Документация
| Файл | Содержимое |
|------|-----------|
| [docs/phases-history.md](docs/phases-history.md) | Подробная история всех фаз |
| [backend/README.md](backend/README.md) | API endpoints, БД, auth, .env |
| [frontend/README.md](frontend/README.md) | Компоненты, hooks, pages |
| [.claude/rules/coding-standards.md](.claude/rules/coding-standards.md) | Стандарты кода (React, FastAPI, Tailwind) |
| [docs/yookassa-integration.md](docs/yookassa-integration.md) | ЮКасса API + webhook |
| [docs/auth-flow.md](docs/auth-flow.md) | CJM авторизации |
| [docs/product-management.md](docs/product-management.md) | Управление товарами |
