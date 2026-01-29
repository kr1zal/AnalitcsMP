from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Wildberries
    wb_api_token: str

    # Ozon Seller API
    ozon_client_id: str
    ozon_api_key: str

    # Ozon Performance API
    ozon_performance_client_id: str
    ozon_performance_client_secret: str

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Sync security (protect /sync/* endpoints in production)
    # If set, requests must provide this token via:
    # - header: X-Sync-Token: <token>
    # - or: Authorization: Bearer <token>
    sync_token: str | None = None

    # App
    debug: bool = True
    secret_key: str = "change-me-in-production"

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
