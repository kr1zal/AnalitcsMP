"""
PDF Export API
Генерация PDF отчётов через Playwright
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials
from playwright.async_api import async_playwright
import asyncio

from ...config import get_settings
from ...auth import CurrentUser, get_current_user, security
from ...subscription import UserSubscription, require_feature

router = APIRouter()
settings = get_settings()


@router.get("/export/pdf")
async def export_pdf(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("pdf_export")),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    date_from: str = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Конец периода (YYYY-MM-DD)"),
    marketplace: str = Query("all", description="Маркетплейс: all, ozon, wb"),
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

        pdf_bytes = await generate_pdf(print_url)

        filename = f"analytics_{date_from}_{date_to}_{marketplace}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка генерации PDF: {str(e)}"
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
