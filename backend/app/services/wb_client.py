"""
Wildberries API Client
Документация: https://openapi.wildberries.ru/
"""
import asyncio
import httpx
from typing import Optional
from datetime import datetime, timedelta


class WildberriesClient:
    CONTENT_URL = "https://content-api.wildberries.ru"
    STATISTICS_URL = "https://statistics-api.wildberries.ru"
    ANALYTICS_URL = "https://seller-analytics-api.wildberries.ru"
    ADS_URL = "https://advert-api.wildberries.ru"

    def __init__(self, api_token: str):
        self.api_token = api_token
        self.headers = {
            "Authorization": api_token,
            "Content-Type": "application/json"
        }

    async def _request(self, method: str, url: str, **kwargs) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                url,
                headers=self.headers,
                **kwargs
            )
            # WB иногда отвечает 204 (No Content) для отчетов — это не ошибка.
            if response.status_code == 204:
                return None
            response.raise_for_status()
            return response.json()

    # ==================== КОНТЕНТ ====================

    async def get_cards_list(self, limit: int = 100, cursor: Optional[dict] = None) -> dict:
        """Получить список карточек товаров"""
        url = f"{self.CONTENT_URL}/content/v2/get/cards/list"
        payload = {
            "settings": {
                "cursor": cursor or {"limit": limit},
                "filter": {"withPhoto": -1}
            }
        }
        return await self._request("POST", url, json=payload)

    async def get_cards_by_barcode(self, barcodes: list[str]) -> dict:
        """Получить карточки по штрихкодам"""
        url = f"{self.CONTENT_URL}/content/v2/get/cards/list"
        payload = {
            "settings": {
                "cursor": {"limit": 100},
                "filter": {
                    "withPhoto": -1
                }
            }
        }
        result = await self._request("POST", url, json=payload)

        # Фильтруем по штрихкодам
        if "cards" in result:
            filtered_cards = []
            for card in result["cards"]:
                for size in card.get("sizes", []):
                    if any(barcode in barcodes for barcode in size.get("skus", [])):
                        filtered_cards.append(card)
                        break
            result["cards"] = filtered_cards

        return result

    # ==================== СТАТИСТИКА ====================

    async def get_sales(self, date_from: datetime, flag: int = 0) -> list:
        """
        Получить продажи
        flag: 0 - за указанный день, 1 - обновления с date_from
        """
        url = f"{self.STATISTICS_URL}/api/v1/supplier/sales"
        params = {
            "dateFrom": date_from.strftime("%Y-%m-%d"),
            "flag": flag
        }
        return await self._request("GET", url, params=params)

    async def get_orders(self, date_from: datetime, flag: int = 0) -> list:
        """Получить заказы"""
        url = f"{self.STATISTICS_URL}/api/v1/supplier/orders"
        params = {
            "dateFrom": date_from.strftime("%Y-%m-%d"),
            "flag": flag
        }
        return await self._request("GET", url, params=params)

    async def get_stocks(self, date_from: datetime) -> list:
        """Получить остатки на складах"""
        url = f"{self.STATISTICS_URL}/api/v1/supplier/stocks"
        params = {"dateFrom": date_from.strftime("%Y-%m-%d")}
        return await self._request("GET", url, params=params)

    async def get_report_detail(
        self,
        date_from: datetime,
        date_to: datetime,
        limit: int = 100000,
        period: str = "daily",
    ) -> list:
        """
        Детальный отчёт по продажам с удержаниями
        Включает: комиссии, логистику, хранение и т.д.
        """
        url = f"{self.STATISTICS_URL}/api/v5/supplier/reportDetailByPeriod"
        all_rows: list[dict] = []
        rrdid = 0

        # API поддерживает пагинацию через rrdid: грузим, пока не придёт 204.
        # Важно: period="daily" — нужен дневной разрез для корректной агрегации.
        while True:
            params = {
                "dateFrom": date_from.strftime("%Y-%m-%dT00:00:00"),
                "dateTo": date_to.strftime("%Y-%m-%dT23:59:59"),
                "limit": limit,
                "rrdid": rrdid,
                "period": period,
            }
            chunk = await self._request("GET", url, params=params)
            if not chunk:
                break
            if not isinstance(chunk, list):
                break

            all_rows.extend(chunk)
            last = chunk[-1]
            next_rrd = last.get("rrd_id")
            if not next_rrd or next_rrd == rrdid:
                break
            rrdid = next_rrd

            # safety: если API вдруг зациклится
            if len(all_rows) > 1_500_000:
                break

        return all_rows

    # ==================== АНАЛИТИКА ====================

    async def get_funnel(self, date_from: datetime, date_to: datetime, nm_ids: list[int]) -> dict:
        """
        Получить воронку продаж (переходы, корзины, заказы)
        """
        url = f"{self.ANALYTICS_URL}/api/v2/nm-report/detail"
        payload = {
            "nmIDs": nm_ids,
            "period": {
                "begin": date_from.strftime("%Y-%m-%d"),
                "end": date_to.strftime("%Y-%m-%d")
            },
            "page": 1
        }
        return await self._request("POST", url, json=payload)

    async def get_geo_sales(self, date_from: datetime, date_to: datetime) -> dict:
        """Получить географию продаж"""
        url = f"{self.ANALYTICS_URL}/api/v1/analytics/region-sale"
        payload = {
            "dateFrom": date_from.strftime("%Y-%m-%d"),
            "dateTo": date_to.strftime("%Y-%m-%d")
        }
        return await self._request("POST", url, json=payload)

    # ==================== РЕКЛАМА ====================

    async def get_advert_campaigns(self) -> list:
        """Получить список рекламных кампаний"""
        url = f"{self.ADS_URL}/adv/v1/promotion/count"
        return await self._request("GET", url)

    async def get_advert_stats(self, campaign_ids: list[int], date_from: datetime, date_to: datetime) -> list:
        """Получить статистику по рекламным кампаниям"""
        url = f"{self.ADS_URL}/adv/v2/fullstats"
        payload = [
            {
                "id": campaign_id,
                "interval": {
                    "begin": date_from.strftime("%Y-%m-%d"),
                    "end": date_to.strftime("%Y-%m-%d")
                }
            }
            for campaign_id in campaign_ids
        ]
        return await self._request("POST", url, json=payload)

    # ==================== ХРАНЕНИЕ (PAID STORAGE) ====================

    async def get_paid_storage(self, date_from: str, date_to: str) -> list[dict]:
        """
        Получить данные по платному хранению (3-step async).

        API: GET /api/v1/paid_storage → taskId → poll status → download.
        Максимальный период: 8 дней. Если period > 8 дней — разбивает на чанки.
        Задержка данных: ~1-2 дня.

        Args:
            date_from: "YYYY-MM-DD"
            date_to: "YYYY-MM-DD"

        Returns:
            List of storage rows (per-product, per-day, per-warehouse).
            Каждая строка содержит: nmId, barcode, warehousePrice, barcodesCount,
            volume, warehouse, calcType, date и т.д.
        """
        # Split into 8-day chunks (API limit)
        from_dt = datetime.strptime(date_from, "%Y-%m-%d")
        to_dt = datetime.strptime(date_to, "%Y-%m-%d")
        all_rows: list[dict] = []

        chunk_start = from_dt
        while chunk_start <= to_dt:
            chunk_end = min(chunk_start + timedelta(days=7), to_dt)  # 8 days max (inclusive)
            chunk_from_str = chunk_start.strftime("%Y-%m-%d")
            chunk_to_str = chunk_end.strftime("%Y-%m-%d")

            chunk_data = await self._get_paid_storage_chunk(chunk_from_str, chunk_to_str)
            if chunk_data:
                all_rows.extend(chunk_data)

            chunk_start = chunk_end + timedelta(days=1)

        return all_rows

    async def _get_paid_storage_chunk(self, date_from: str, date_to: str) -> list[dict]:
        """
        Один запрос paid_storage (макс 8 дней).
        3-step: create task → poll status → download.
        """
        base_url = self.ANALYTICS_URL

        # Step 1: Create task
        url = f"{base_url}/api/v1/paid_storage"
        params = {"dateFrom": date_from, "dateTo": date_to}
        result = await self._request("GET", url, params=params)
        if not result or "data" not in result:
            return []

        task_id = result["data"].get("taskId")
        if not task_id:
            return []

        # Step 2: Poll status (every 3 sec, max 2 min = 40 attempts)
        status_url = f"{base_url}/api/v1/paid_storage/tasks/{task_id}/status"
        for _ in range(40):
            await asyncio.sleep(3)
            status_result = await self._request("GET", status_url)
            if not status_result or "data" not in status_result:
                continue
            status = status_result["data"].get("status", "")
            if status == "done":
                break
            if status in ("purged", "canceled"):
                return []
        else:
            return []  # timeout

        # Step 3: Download (with retry on 429)
        download_url = f"{base_url}/api/v1/paid_storage/tasks/{task_id}/download"
        for attempt in range(3):
            try:
                data = await self._request("GET", download_url)
                if isinstance(data, list):
                    return data
                if isinstance(data, dict) and "data" in data:
                    return data["data"] if isinstance(data["data"], list) else []
                return []
            except Exception as e:
                if "429" in str(e) and attempt < 2:
                    await asyncio.sleep(10 * (attempt + 1))
                    continue
                raise
