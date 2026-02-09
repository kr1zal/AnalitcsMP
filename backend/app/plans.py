"""
Subscription plan definitions.
Hardcoded — no DB table needed for 3 static tiers.
"""
from datetime import datetime, timezone, timedelta

PLANS = {
    "free": {
        "name": "Free",
        "price_rub": 0,
        "max_sku": 3,
        "marketplaces": ["wb"],
        "auto_sync": False,
        "sync_interval_hours": None,
        "manual_sync_limit": 0,
        "sync_schedule_utc": [5, 17],  # MSK 08:00, 20:00
        "sync_priority": 2,
        "features": {
            "dashboard": True,
            "costs_tree_basic": True,
            "costs_tree_details": False,
            "unit_economics": False,
            "ads_page": False,
            "pdf_export": False,
            "period_comparison": False,
            "api_access": False,
        },
    },
    "pro": {
        "name": "Pro",
        "price_rub": 990,
        "max_sku": 20,
        "marketplaces": ["wb", "ozon"],
        "auto_sync": True,
        "sync_interval_hours": 6,
        "manual_sync_limit": 1,
        "sync_schedule_utc": [4, 10, 16, 22],  # MSK 07:00, 13:00, 19:00, 01:00
        "sync_priority": 1,
        "features": {
            "dashboard": True,
            "costs_tree_basic": True,
            "costs_tree_details": True,
            "unit_economics": True,
            "ads_page": True,
            "pdf_export": True,
            "period_comparison": True,
            "api_access": False,
        },
    },
    "business": {
        "name": "Business",
        "price_rub": 2990,
        "max_sku": None,  # unlimited
        "marketplaces": ["wb", "ozon"],
        "auto_sync": True,
        "sync_interval_hours": 2,
        "manual_sync_limit": 2,
        "sync_schedule_utc": [3, 9, 15, 21],  # MSK 06:00, 12:00, 18:00, 00:00
        "sync_priority": 0,
        "features": {
            "dashboard": True,
            "costs_tree_basic": True,
            "costs_tree_details": True,
            "unit_economics": True,
            "ads_page": True,
            "pdf_export": True,
            "period_comparison": True,
            "api_access": True,
        },
    },
}


def get_plan(plan_name: str) -> dict:
    """Get plan config by name, fallback to free."""
    return PLANS.get(plan_name, PLANS["free"])


def has_feature(plan_name: str, feature: str) -> bool:
    """Check if a plan has a specific feature enabled."""
    plan = get_plan(plan_name)
    return plan.get("features", {}).get(feature, False)


def get_next_sync_utc(plan_name: str, after: datetime | None = None) -> datetime:
    """Calculate next scheduled sync time (UTC) for a plan.

    Schedule hours are stored as UTC hours in sync_schedule_utc.
    Returns the earliest future UTC hour from the schedule.
    """
    plan = get_plan(plan_name)
    schedule = plan.get("sync_schedule_utc", [5, 17])

    if after is None:
        after = datetime.now(timezone.utc)

    current_hour = after.hour
    current_date = after.date()

    # Find next scheduled hour today or tomorrow
    for h in sorted(schedule):
        candidate = datetime(current_date.year, current_date.month, current_date.day,
                             h, 0, 0, tzinfo=timezone.utc)
        if candidate > after:
            return candidate

    # All today's slots passed — first slot tomorrow
    tomorrow = current_date + timedelta(days=1)
    first_hour = sorted(schedule)[0]
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day,
                    first_hour, 0, 0, tzinfo=timezone.utc)
