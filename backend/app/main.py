"""
FastAPI приложение для аналитики маркетплейсов WB и Ozon
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import get_settings
from .api.v1 import products, dashboard, sync, export, tokens, subscription

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events"""
    # Startup
    print("Starting Analytics API...")
    yield
    # Shutdown
    print("Shutting down Analytics API...")


app = FastAPI(
    title="Analytics Dashboard API",
    description="API для аналитики продаж на Wildberries и Ozon",
    version="1.0.0",
    lifespan=lifespan,
    debug=settings.debug
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://analitics.bixirun.ru",
        "http://localhost:5173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(products.router, prefix="/api/v1", tags=["Products"])
app.include_router(dashboard.router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(sync.router, prefix="/api/v1", tags=["Sync"])
app.include_router(export.router, prefix="/api/v1", tags=["Export"])
app.include_router(tokens.router, prefix="/api/v1", tags=["Tokens"])
app.include_router(subscription.router, prefix="/api/v1", tags=["Subscription"])


@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "app": "Analytics Dashboard API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "ok"}
