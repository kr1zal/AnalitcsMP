"""
PDF Export API
Генерация PDF отчётов через Playwright
"""
import logging

from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials
from playwright.async_api import async_playwright
import asyncio

from ...config import get_settings
from ...auth import CurrentUser, get_current_user, security
from ...subscription import UserSubscription, require_feature

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()

# Limit concurrent Playwright instances to prevent OOM with 4 uvicorn workers
_pdf_semaphore = asyncio.Semaphore(1)


@router.get("/export/pdf")
async def export_pdf(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("pdf_export")),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    date_from: str = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Конец периода (YYYY-MM-DD)"),
    marketplace: str = Query("all", description="Маркетплейс: all, ozon, wb"),
    fulfillment_type: str = Query(None, description="Тип фулфилмента: FBO, FBS"),
):
    """
    Генерация PDF отчёта через Playwright.
    Передаёт JWT токен в PrintPage для загрузки данных.
    """
    try:
        token = credentials.credentials if credentials else ""
        print_url = (
            f"{settings.frontend_url}/print"
            f"?from={date_from}&to={date_to}&marketplace={marketplace}"
            f"&token={token}"
        )
        if fulfillment_type:
            print_url += f"&fulfillment_type={fulfillment_type}"

        try:
            async with asyncio.timeout(120):
                async with _pdf_semaphore:
                    pdf_bytes = await generate_pdf(print_url)
        except TimeoutError:
            raise HTTPException(
                status_code=503,
                detail="Генерация PDF занята, попробуйте позже"
            )

        filename = f"analytics_{date_from}_{date_to}_{marketplace}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "token=" in error_msg:
            error_msg = error_msg.split("token=")[0] + "token=[REDACTED]"
        logger.error(f"PDF generation failed: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail="Ошибка генерации PDF"
        )


async def generate_pdf(url: str, timeout: int = 60000) -> bytes:
    """
    Генерация PDF из URL через Playwright.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ]
        )

        try:
            context = await browser.new_context(
                viewport={'width': 1200, 'height': 800},
                device_scale_factor=2,
            )
            page = await context.new_page()

            await page.goto(url, wait_until='networkidle', timeout=timeout)

            try:
                await page.wait_for_selector(
                    '[data-pdf-ready="true"]',
                    timeout=30000
                )
            except Exception:
                logger.warning("PDF ready selector not found, proceeding after delay")
                await asyncio.sleep(3)

            pdf_bytes = await page.pdf(
                format='A4',
                landscape=True,
                print_background=True,
                margin={
                    'top': '10mm',
                    'right': '10mm',
                    'bottom': '10mm',
                    'left': '10mm',
                },
            )

            return pdf_bytes

        finally:
            await browser.close()
