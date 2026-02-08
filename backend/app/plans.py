"""
Subscription plan definitions.
Hardcoded — no DB table needed for 3 static tiers.
"""

PLANS = {
    "free": {
        "name": "Free",
        "price_rub": 0,
        "max_sku": 3,
        "marketplaces": ["wb"],
        "auto_sync": False,
        "sync_interval_hours": None,
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
