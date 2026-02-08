"""
Роутер для работы с товарами
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from ...db.supabase import get_supabase_client
from ...auth import CurrentUser, get_current_user

router = APIRouter()


@router.get("/products")
async def get_products(
    current_user: CurrentUser = Depends(get_current_user),
    marketplace: Optional[str] = None,
):
    """
    Получить список всех товаров
    """
    supabase = get_supabase_client()

    try:
        query = supabase.table("mp_products").select("*").eq("user_id", current_user.id)

        if marketplace == "wb":
            query = query.not_.is_("wb_nm_id", "null")
        elif marketplace == "ozon":
            query = query.not_.is_("ozon_product_id", "null")

        result = query.execute()

        return {
            "status": "success",
            "count": len(result.data),
            "products": result.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/products/{product_id}")
async def get_product_by_id(
    product_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Получить товар по ID (UUID)
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table("mp_products").select("*").eq("id", product_id).eq("user_id", current_user.id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Product not found")

        return {
            "status": "success",
            "product": result.data[0]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/products/barcode/{barcode}")
async def get_product_by_barcode(
    barcode: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Получить товар по штрихкоду
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table("mp_products").select("*").eq("barcode", barcode).eq("user_id", current_user.id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Product not found")

        return {
            "status": "success",
            "product": result.data[0]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
