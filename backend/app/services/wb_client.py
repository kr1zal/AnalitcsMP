"""
Wildberries API Client
Документация: https://openapi.wildberries.ru/
"""
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
