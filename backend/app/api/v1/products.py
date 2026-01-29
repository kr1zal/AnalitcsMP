"""
Роутер для работы с товарами
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional

from ...db.supabase import get_supabase_client

router = APIRouter()


@router.get("/products")
async def get_products(
    marketplace: Optional[str] = None
):
    """
    Получить список всех товаров

    - **marketplace**: фильтр по МП (wb, ozon) - опционально
    """
    supabase = get_supabase_client()

    try:
        query = supabase.table("mp_products").select("*")

        # Если нужна фильтрация по наличию ID конкретного МП
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
async def get_product_by_id(product_id: str):
    """
    Получить товар по ID (UUID)
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table("mp_products").select("*").eq("id", product_id).execute()

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
async def get_product_by_barcode(barcode: str):
    """
    Получить товар по штрихкоду
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table("mp_products").select("*").eq("barcode", barcode).execute()

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
