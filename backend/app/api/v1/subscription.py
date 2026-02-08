"""
Subscription endpoints:
- GET /subscription        - current user's plan + limits + features
- GET /subscription/plans  - all available plans (public comparison)
- PUT /subscription        - admin-only: change a user's plan
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime

from ...auth import CurrentUser, get_current_user
from ...db.supabase import get_supabase_client
from ...subscription import get_user_subscription, UserSubscription
from ...plans import PLANS

router = APIRouter()

ADMIN_USER_IDS = ["17e80396-86e1-4ec8-8cb2-f727462bf20c"]


@router.get("/subscription")
async def get_my_subscription(
    sub: UserSubscription = Depends(get_user_subscription),
):
    """Return current user's subscription with full plan details."""
    supabase = get_supabase_client()
    products = (
        supabase.table("mp_products")
        .select("id")
        .eq("user_id", sub.user_id)
        .neq("barcode", "WB_ACCOUNT")
        .execute()
    )
    sku_count = len(products.data) if products.data else 0
    max_sku = sub.plan_config.get("max_sku")

    return {
        "plan": sub.plan,
        "status": sub.status,
        "plan_name": sub.plan_config["name"],
        "limits": {
            "max_sku": max_sku,
            "current_sku": sku_count,
            "sku_remaining": (max_sku - sku_count) if max_sku is not None else None,
            "marketplaces": sub.plan_config["marketplaces"],
            "auto_sync": sub.plan_config["auto_sync"],
            "sync_interval_hours": sub.plan_config["sync_interval_hours"],
        },
        "features": sub.plan_config["features"],
    }


@router.get("/subscription/plans")
async def list_plans():
    """Return all available plans for comparison/upgrade UI."""
    result = []
    for key, plan in PLANS.items():
        result.append({
            "id": key,
            "name": plan["name"],
            "price_rub": plan["price_rub"],
            "max_sku": plan["max_sku"],
            "marketplaces": plan["marketplaces"],
            "auto_sync": plan["auto_sync"],
            "sync_interval_hours": plan["sync_interval_hours"],
            "features": plan["features"],
        })
    return {"plans": result}


class ChangePlanRequest(BaseModel):
    user_id: str
    plan: str


@router.put("/subscription")
async def change_user_plan(
    body: ChangePlanRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Admin-only: change a user's subscription plan."""
    if current_user.id not in ADMIN_USER_IDS:
        raise HTTPException(status_code=403, detail="Admin access required")

    if body.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}")

    supabase = get_supabase_client()
    supabase.table("mp_user_subscriptions").upsert({
        "user_id": body.user_id,
        "plan": body.plan,
        "status": "active",
        "changed_by": current_user.email,
        "updated_at": datetime.now().isoformat(),
    }, on_conflict="user_id").execute()

    return {"status": "updated", "user_id": body.user_id, "plan": body.plan}
