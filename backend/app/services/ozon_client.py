"""
Ozon API Client
Документация: https://docs.ozon.ru/api/seller/
"""
import httpx
from typing import Optional, Any
from datetime import datetime


class OzonClient:
    BASE_URL = "https://api-seller.ozon.ru"

    def __init__(self, client_id: str, api_key: str):
        self.client_id = client_id
        self.api_key = api_key
        self.headers = {
            "Client-Id": client_id,
            "Api-Key": api_key,
            "Content-Type": "application/json"
        }

    async def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        url = f"{self.BASE_URL}{endpoint}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(method, url, headers=self.headers, **kwargs)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                # Ozon часто возвращает полезный JSON с деталями ошибки
                try:
                    body = response.text
                except Exception:
                    body = ""
                raise httpx.HTTPStatusError(
                    f"{e} | response_body={body}",
                    request=e.request,
                    response=e.response,
                ) from None
            return response.json()

    # ==================== ТОВАРЫ ====================

    async def get_product_list(self, limit: int = 100, last_id: str = "") -> dict:
        """Получить список товаров (v3)"""
        payload = {
            "filter": {},
            "limit": limit,
            "last_id": last_id
        }
        return await self._request("POST", "/v3/product/list", json=payload)

    async def get_product_info(self, product_ids: list[int] = None, offer_ids: list[str] = None, skus: list[int] = None) -> dict:
        """Получить информацию о товарах (v3)"""
        payload = {}
        if product_ids:
            payload["product_id"] = product_ids
        if offer_ids:
            payload["offer_id"] = offer_ids
        if skus:
            payload["sku"] = skus
        return await self._request("POST", "/v3/product/info/list", json=payload)

    async def get_products_by_barcode(self, barcodes: list[str]) -> dict:
        """Получить товары по штрихкодам"""
        # Сначала получаем все товары
        all_products = []
        last_id = ""

        while True:
            result = await self.get_product_list(limit=100, last_id=last_id)
            items = result.get("result", {}).get("items", [])
            if not items:
                break
            all_products.extend(items)
            last_id = result.get("result", {}).get("last_id", "")
            if not last_id:
                break

        # Получаем детальную информацию
        product_ids = [p["product_id"] for p in all_products]
        if product_ids:
            details = await self.get_product_info(product_ids=product_ids)
            products_detail = details.get("result", {}).get("items", [])

            # Фильтруем по штрихкодам
            filtered = [
                p for p in products_detail
                if p.get("barcode") in barcodes
            ]
            return {"items": filtered}

        return {"items": []}

    # ==================== ОСТАТКИ ====================

    async def get_stocks(
        self,
        filter: Optional[dict[str, Any]] = None,
        last_id: Optional[str | int] = None,
        limit: Optional[int] = None,
    ) -> dict:
        """
        Получить остатки на складах (v4).

        Важно:
        - На практике иногда требуется filter.visibility="ALL" и/или явный filter.offer_id,
          иначе API может вернуть items=[] даже при наличии остатков.
        - Пагинация у метода идёт через last_id (из ответа).
        """
        payload: dict[str, Any] = {"filter": filter or {}}
        # В некоторых реализациях limit обязателен. Дефолт 1000.
        payload["limit"] = int(limit) if isinstance(limit, int) else 1000
        # last_id передаём только если он не пустой
        if last_id not in (None, "", 0):
            payload["last_id"] = last_id
        return await self._request("POST", "/v4/product/info/stocks", json=payload)

    async def get_stocks_on_warehouses(
        self,
        limit: int = 100,
        offset: int = 0,
        warehouse_type: str = "ALL",
    ) -> dict:
        """
        Получить отчёт об остатках на складах Ozon (Analytics v2).

        Это основной источник для FBO ("Склад Ozon / Активный сток").

        Request:
          POST /v2/analytics/stock_on_warehouses
          { "limit": 100, "offset": 0, "warehouse_type": "ALL" }

        Response:
          { "result": { "rows": [{ sku, item_code, item_name, free_to_sell_amount, reserved_amount, promised_amount, warehouse_name }] } }
        """
        payload = {
            "limit": int(limit),
            "offset": int(offset),
            "warehouse_type": warehouse_type,
        }
        return await self._request("POST", "/v2/analytics/stock_on_warehouses", json=payload)

    async def get_all_stocks_on_warehouses(
        self,
        warehouse_type: str = "ALL",
        limit: int = 100,
        max_pages: int = 200,
    ) -> dict:
        """
        Выгрузить все строки отчёта stock_on_warehouses с пагинацией по offset.
        Возвращает тот же формат ответа, но rows — склеенный список.
        """
        all_rows: list[dict[str, Any]] = []
        last_page: dict | None = None
        offset = 0

        for _ in range(max_pages):
            page = await self.get_stocks_on_warehouses(
                limit=limit,
                offset=offset,
                warehouse_type=warehouse_type,
            )
            last_page = page
            rows = (page or {}).get("result", {}).get("rows") or []
            if not rows:
                break
            all_rows.extend(rows)
            if len(rows) < limit:
                break
            offset += limit

        merged = dict(last_page or {})
        merged["result"] = dict((last_page or {}).get("result") or {})
        merged["result"]["rows"] = all_rows
        return merged

    async def get_stocks_legacy_offset(
        self,
        filter: Optional[dict[str, Any]] = None,
        offset: int = 0,
        limit: int = 100,
    ) -> dict:
        """
        Legacy/совместимый вариант запроса остатков.
        Некоторые конфигурации принимают offset вместо last_id.
        """
        payload: dict[str, Any] = {"filter": filter or {}, "limit": int(limit), "offset": int(offset)}
        return await self._request("POST", "/v4/product/info/stocks", json=payload)

    async def get_all_stocks(
        self,
        filter: Optional[dict[str, Any]] = None,
        limit: Optional[int] = None,
        max_pages: int = 50,
    ) -> dict:
        """
        Выгрузить все остатки с пагинацией по last_id.
        Возвращает тот же формат, но items — склеенный список.
        """
        # Strategy A: paginate via last_id
        all_items: list[dict[str, Any]] = []
        last_id: Optional[str | int] = None
        last_page: dict | None = None

        try:
            for _ in range(max_pages):
                page = await self.get_stocks(filter=filter, last_id=last_id, limit=limit)
                last_page = page
                result = (page or {}).get("result") or {}
                items = result.get("items") or []
                if items:
                    all_items.extend(items)

                next_last_id = result.get("last_id")
                if not next_last_id:
                    break
                if next_last_id == last_id:
                    break
                last_id = next_last_id

            merged = dict(last_page or {})
            merged["result"] = dict((last_page or {}).get("result") or {})
            merged["result"]["items"] = all_items
            return merged
        except httpx.HTTPStatusError as e:
            if getattr(e.response, "status_code", None) != 400:
                raise

        # Strategy B: fallback to legacy offset paging
        all_items = []
        last_page = None
        offset = 0
        page_limit = int(limit) if isinstance(limit, int) else 100

        for _ in range(max_pages):
            page = await self.get_stocks_legacy_offset(filter=filter, offset=offset, limit=page_limit)
            last_page = page
            result = (page or {}).get("result") or {}
            items = result.get("items") or []
            if not items:
                break
            all_items.extend(items)
            offset += page_limit

        merged = dict(last_page or {})
        merged["result"] = dict((last_page or {}).get("result") or {})
        merged["result"]["items"] = all_items
        return merged

    async def get_warehouse_list(self) -> dict:
        """Получить список складов"""
        return await self._request("POST", "/v1/warehouse/list", json={})

    # ==================== ЗАКАЗЫ И ПРОДАЖИ ====================

    async def get_posting_fbs_list(self, date_from: datetime, date_to: datetime, limit: int = 100, offset: int = 0) -> dict:
        """Получить список отправлений FBS"""
        payload = {
            "filter": {
                "since": date_from.strftime("%Y-%m-%dT00:00:00.000Z"),
                "to": date_to.strftime("%Y-%m-%dT23:59:59.999Z")
            },
            "limit": limit,
            "offset": offset,
            "with": {
                "analytics_data": True,
                "financial_data": True
            }
        }
        return await self._request("POST", "/v3/posting/fbs/list", json=payload)

    # ==================== ФИНАНСЫ ====================

    async def get_finance_transaction_list(self, date_from: datetime, date_to: datetime, page: int = 1) -> dict:
        """
        Получить список транзакций (комиссии, логистика и т.д.)
        """
        payload = {
            "filter": {
                "date": {
                    "from": date_from.strftime("%Y-%m-%dT00:00:00.000Z"),
                    "to": date_to.strftime("%Y-%m-%dT23:59:59.999Z")
                },
                "transaction_type": "all"
            },
            "page": page,
            "page_size": 1000
        }
        return await self._request("POST", "/v3/finance/transaction/list", json=payload)

    async def get_finance_totals(self, date_from: datetime, date_to: datetime) -> dict:
        """Получить итоги по финансам"""
        payload = {
            "date": {
                "from": date_from.strftime("%Y-%m-%dT00:00:00.000Z"),
                "to": date_to.strftime("%Y-%m-%dT23:59:59.999Z")
            }
        }
        return await self._request("POST", "/v1/finance/realization", json=payload)

    # ==================== АНАЛИТИКА ====================

    async def get_analytics_data(self, date_from: datetime, date_to: datetime, dimensions: list[str] = None, metrics: list[str] = None) -> dict:
        """
        Получить аналитику
        dimensions: ["sku"], ["sku", "day"], ["day"], ["week"], ["month"]
        metrics: hits_view, hits_tocart, session_view, revenue, ordered_units и т.д.
        """
        if dimensions is None:
            dimensions = ["sku"]
        if metrics is None:
            metrics = ["hits_view", "hits_tocart", "session_view", "revenue", "ordered_units"]

        payload = {
            "date_from": date_from.strftime("%Y-%m-%d"),
            "date_to": date_to.strftime("%Y-%m-%d"),
            "dimension": dimensions,
            "metrics": metrics,
            "limit": 1000,
            "offset": 0
        }
        return await self._request("POST", "/v1/analytics/data", json=payload)


class OzonPerformanceClient:
    """Клиент для Ozon Performance API (реклама)"""
    AUTH_URL = "https://api-performance.ozon.ru/api/client/token"
    BASE_URL = "https://api-performance.ozon.ru"

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token: Optional[str] = None

    async def _get_token(self) -> str:
        """Получить токен доступа"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.AUTH_URL,
                json={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials"
                }
            )
            response.raise_for_status()
            data = response.json()
            self.access_token = data["access_token"]
            return self.access_token

    async def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        if not self.access_token:
            await self._get_token()

        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()

    async def _download_report_csv(self, link: str) -> list:
        """
        Скачать CSV-отчёт по link и распарсить в список словарей.
        Ozon Performance отдаёт данные в CSV с разделителем ';'
        """
        import csv
        import io

        if not self.access_token:
            await self._get_token()

        url = f"{self.BASE_URL}{link}" if link.startswith("/") else link
        headers = {
            "Authorization": f"Bearer {self.access_token}",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

        content = response.text.lstrip('\ufeff')  # Remove BOM
        lines = content.strip().split('\n')

        # Первая строка — заголовок кампании, пропускаем
        # Вторая строка — заголовки колонок
        # Далее — данные (последняя строка "Всего" — итоги)
        if len(lines) < 3:
            return []

        # Парсим CSV
        rows = []
        reader = csv.reader(lines[1:], delimiter=';')
        headers_row = next(reader)

        for row in reader:
            if not row or row[0] == 'Всего':
                continue

            # Маппим CSV колонки в словарь
            try:
                date_str = row[0].strip() if row[0] else ""
                if not date_str:
                    continue

                # Конвертируем дату из DD.MM.YYYY в YYYY-MM-DD
                if '.' in date_str:
                    parts = date_str.split('.')
                    if len(parts) == 3:
                        date_str = f"{parts[2]}-{parts[1]}-{parts[0]}"

                def parse_num(val: str) -> float:
                    return float(val.replace(',', '.').replace('\xa0', '').strip() or '0')

                rows.append({
                    "date": date_str,
                    "views": int(parse_num(row[4])) if len(row) > 4 else 0,
                    "clicks": int(parse_num(row[5])) if len(row) > 5 else 0,
                    "expense": parse_num(row[9]) if len(row) > 9 else 0,
                    "orders": int(parse_num(row[10])) if len(row) > 10 else 0,
                })
            except (ValueError, IndexError):
                continue

        return rows

    async def get_campaigns(self) -> dict:
        """Получить список рекламных кампаний"""
        return await self._request("GET", "/api/client/campaign")

    async def get_campaign_stats(self, campaign_ids: list[str], date_from: datetime, date_to: datetime) -> dict:
        """
        Получить статистику рекламных кампаний.
        Ozon Performance API работает асинхронно:
        1. POST /statistics -> возвращает UUID отчёта
        2. GET /statistics/{UUID} -> polling до state=OK

        Ограничение: максимум 1 активный запрос одновременно.
        """
        import asyncio

        payload = {
            "campaigns": campaign_ids,
            "dateFrom": date_from.strftime("%Y-%m-%d"),
            "dateTo": date_to.strftime("%Y-%m-%d"),
            "groupBy": "DATE"
        }

        # Шаг 1: Создаём запрос на отчёт
        response = await self._request("POST", "/api/client/statistics", json=payload)
        report_uuid = response.get("UUID")

        if not report_uuid:
            return {"rows": []}

        # Шаг 2: Polling — ждём готовности отчёта (макс 90 сек)
        for attempt in range(30):
            await asyncio.sleep(3)
            try:
                result = await self._request("GET", f"/api/client/statistics/{report_uuid}")
                if not isinstance(result, dict):
                    continue

                state = result.get("state", "")
                if state == "OK":
                    # Отчёт готов — данные доступны по link (CSV формат)
                    link = result.get("link", "")
                    if link:
                        rows = await self._download_report_csv(link)
                        return {"rows": rows}
                    return {"rows": []}
                elif state in ("ERROR", "CANCELLED"):
                    return {"rows": []}
                # Иначе — ещё обрабатывается (NOT_STARTED, IN_PROGRESS)
            except Exception:
                continue

        return {"rows": []}
