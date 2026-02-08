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

    # Sync security (legacy, unused — replaced by JWT auth)
    sync_token: str | None = None

    # Cron secret for server-side sync jobs (X-Cron-Secret header)
    sync_cron_secret: str | None = None

    # Fernet encryption key for user API tokens
    fernet_key: str = ""

    # App
    debug: bool = True

    # Frontend URL for PDF export (Playwright opens this)
    # Локально: добавь FRONTEND_URL=http://localhost:5173 в .env
    # Production: дефолт https://analitics.bixirun.ru
    frontend_url: str = "https://analitics.bixirun.ru"

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
