"""
Subscription management: load user plan, enforce limits.
Uses service_role_key (via get_supabase_client) for all operations.
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException

from .auth import CurrentUser, get_current_user, get_current_user_or_cron
from .db.supabase import get_supabase_client
from .plans import get_plan, has_feature, PLANS


@dataclass
class UserSubscription:
    user_id: str
    plan: str         # 'free', 'pro', 'business'
    status: str       # 'active', 'cancelled', 'expired'
    plan_config: dict  # full plan definition from PLANS


def _load_subscription(user_id: str) -> UserSubscription:
    """
    Load user's subscription from DB.
    Auto-creates 'free' row if none exists (first login).
    """
    supabase = get_supabase_client()
    result = (
        supabase.table("mp_user_subscriptions")
        .select("plan, status")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        # Auto-create free subscription
        supabase.table("mp_user_subscriptions").insert({
            "user_id": user_id,
            "plan": "free",
            "status": "active",
        }).execute()
        plan_name = "free"
        status = "active"
    else:
        row = result.data[0]
        plan_name = row.get("plan", "free")
        status = row.get("status", "active")

    # Expired/cancelled -> treat as free
    if status != "active":
        plan_name = "free"

    return UserSubscription(
        user_id=user_id,
        plan=plan_name,
        status=status,
        plan_config=get_plan(plan_name),
    )


async def get_user_subscription(
    current_user: CurrentUser = Depends(get_current_user),
) -> UserSubscription:
    """FastAPI dependency: load subscription for JWT-authenticated user."""
    return _load_subscription(current_user.id)


async def get_subscription_or_cron(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
) -> UserSubscription:
    """FastAPI dependency: load subscription for JWT user or cron."""
    return _load_subscription(current_user.id)


def require_feature(feature: str):
    """
    Returns a FastAPI dependency that checks if the user's plan has a feature.
    Usage: sub: UserSubscription = Depends(require_feature("pdf_export"))
    """
    async def _check(sub: UserSubscription = Depends(get_user_subscription)):
        if not has_feature(sub.plan, feature):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_not_available",
                    "feature": feature,
                    "current_plan": sub.plan,
                    "required_plan": _minimum_plan_for_feature(feature),
                    "message": f"Feature '{feature}' requires a higher plan. Current: {sub.plan}",
                }
            )
        return sub
    return _check


def _minimum_plan_for_feature(feature: str) -> str:
    """Find the cheapest plan that has this feature."""
    for plan_name in ["free", "pro", "business"]:
        if has_feature(plan_name, feature):
            return plan_name
    return "business"
