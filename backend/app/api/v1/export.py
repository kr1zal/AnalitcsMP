"""
PDF Export API
Генерация PDF отчётов через Playwright
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response
from playwright.async_api import async_playwright
import asyncio
from typing import Optional

from ...config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/export/pdf")
async def export_pdf(
    date_from: str = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Конец периода (YYYY-MM-DD)"),
    marketplace: str = Query("all", description="Маркетплейс: all, ozon, wb"),
):
    """
    Генерация PDF отчёта через Playwright.

    Открывает /print страницу на фронтенде, ждёт загрузки данных,
    и генерирует PDF с помощью Chromium.
    """
    try:
        # Формируем URL для print страницы
        print_url = (
            f"{settings.frontend_url}/print"
            f"?from={date_from}&to={date_to}&marketplace={marketplace}"
        )

        # Генерируем PDF через Playwright
        pdf_bytes = await generate_pdf(print_url)

        # Формируем имя файла
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

    Args:
        url: URL страницы для рендеринга
        timeout: Максимальное время ожидания (мс)

    Returns:
        PDF как bytes
    """
    async with async_playwright() as p:
        # Запускаем браузер
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
            # Создаём контекст и страницу
            context = await browser.new_context(
                viewport={'width': 1200, 'height': 800},
                device_scale_factor=2,  # Retina качество
            )
            page = await context.new_page()

            # Открываем страницу
            await page.goto(url, wait_until='networkidle', timeout=timeout)

            # Ждём пока появится маркер готовности
            # (фронтенд должен добавить data-pdf-ready="true" когда данные загружены)
            try:
                await page.wait_for_selector(
                    '[data-pdf-ready="true"]',
                    timeout=30000
                )
            except Exception:
                # Если маркера нет — ждём 3 секунды на всякий случай
                await asyncio.sleep(3)

            # Генерируем PDF
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
