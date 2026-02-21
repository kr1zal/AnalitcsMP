"""
Роутер для конфигурации виджетов дашборда — персонализация карточек метрик
"""
import logging
import re

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Optional

from ...db.supabase import get_supabase_client
from ...auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)

# Regex for valid widget IDs (lowercase letters + underscores)
WIDGET_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,50}$")

router = APIRouter(tags=["dashboard-config"])

# Default enabled widgets (ordered list of widget IDs)
DEFAULT_ENABLED_WIDGETS: list[str] = [
    "orders_count",
    "orders_revenue",
    "revenue_settled",
    "purchase_costs",
    "net_profit",
    "mp_deductions",
    "ad_cost",
    "payout",
    "drr",
    "profit_margin",
    "period_delta",
]

DEFAULT_COLUMN_COUNT = 4


class DashboardConfigPayload(BaseModel):
    """Pydantic model для валидации входных данных конфигурации дашборда"""
    enabled_widgets: Optional[list[str]] = None
    layout: Optional[list[dict[str, str | int | float]]] = None
    column_count: Optional[int] = None
    show_axis_badges: Optional[bool] = None
    compact_mode: Optional[bool] = None

    @field_validator("enabled_widgets")
    @classmethod
    def validate_enabled_widgets(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None:
            if not isinstance(v, list):
                raise ValueError("enabled_widgets must be a list of strings")
            for item in v:
                if not isinstance(item, str):
                    raise ValueError(f"Each widget ID must be a string, got {type(item).__name__}")
                if not item.strip():
                    raise ValueError("Widget ID cannot be empty")
                if not WIDGET_ID_PATTERN.match(item):
                    raise ValueError(f"Invalid widget ID format: {item}")
        return v

    @field_validator("column_count")
    @classmethod
    def validate_column_count(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if not (1 <= v <= 6):
                raise ValueError("column_count must be between 1 and 6")
        return v


@router.get("/dashboard/config")
async def get_dashboard_config(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Получить конфигурацию дашборда пользователя.
    Если конфигурация не существует — возвращает дефолтные значения.
    """
    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("user_dashboard_config")
            .select("*")
            .eq("user_id", current_user.id)
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            row = result.data[0]
            return {
                "status": "success",
                "config": {
                    "enabled_widgets": row.get("enabled_widgets", DEFAULT_ENABLED_WIDGETS),
                    "layout": row.get("layout", []),
                    "column_count": row.get("column_count", DEFAULT_COLUMN_COUNT),
                    "show_axis_badges": row.get("show_axis_badges", False),
                    "compact_mode": row.get("compact_mode", False),
                },
            }

        # Нет записи — возвращаем дефолты
        return {
            "status": "success",
            "config": {
                "enabled_widgets": DEFAULT_ENABLED_WIDGETS,
                "layout": [],
                "column_count": DEFAULT_COLUMN_COUNT,
                "show_axis_badges": False,
                "compact_mode": False,
            },
        }

    except Exception as e:
        logger.exception("Failed to load dashboard config for user %s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to load dashboard config")


@router.put("/dashboard/config")
async def update_dashboard_config(
    payload: DashboardConfigPayload,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Создать или обновить конфигурацию дашборда пользователя (upsert).
    Принимает частичное обновление — отправляются только изменённые поля.
    """
    supabase = get_supabase_client()

    try:
        # Собираем только переданные поля для upsert
        upsert_data: dict[str, str | int | bool | list[str] | list[dict[str, str | int | float]]] = {
            "user_id": current_user.id,
        }

        if payload.enabled_widgets is not None:
            upsert_data["enabled_widgets"] = payload.enabled_widgets
        if payload.layout is not None:
            upsert_data["layout"] = payload.layout
        if payload.column_count is not None:
            upsert_data["column_count"] = payload.column_count
        if payload.show_axis_badges is not None:
            upsert_data["show_axis_badges"] = payload.show_axis_badges
        if payload.compact_mode is not None:
            upsert_data["compact_mode"] = payload.compact_mode

        result = (
            supabase.table("user_dashboard_config")
            .upsert(upsert_data, on_conflict="user_id")
            .execute()
        )

        if result.data and len(result.data) > 0:
            row = result.data[0]
            return {
                "status": "success",
                "config": {
                    "enabled_widgets": row.get("enabled_widgets", DEFAULT_ENABLED_WIDGETS),
                    "layout": row.get("layout", []),
                    "column_count": row.get("column_count", DEFAULT_COLUMN_COUNT),
                    "show_axis_badges": row.get("show_axis_badges", False),
                    "compact_mode": row.get("compact_mode", False),
                },
            }

        return {
            "status": "success",
            "config": {
                "enabled_widgets": payload.enabled_widgets if payload.enabled_widgets is not None else DEFAULT_ENABLED_WIDGETS,
                "layout": payload.layout if payload.layout is not None else [],
                "column_count": payload.column_count if payload.column_count is not None else DEFAULT_COLUMN_COUNT,
                "show_axis_badges": payload.show_axis_badges if payload.show_axis_badges is not None else False,
                "compact_mode": payload.compact_mode if payload.compact_mode is not None else False,
            },
        }

    except Exception as e:
        logger.exception("Failed to save dashboard config for user %s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to save dashboard config")
