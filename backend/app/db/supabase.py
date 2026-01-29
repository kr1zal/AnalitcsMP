from supabase import create_client, Client
from ..config import get_settings


def get_supabase_client() -> Client:
    """Получить клиент Supabase с service_role ключом (для backend)"""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )


def get_supabase_anon_client() -> Client:
    """Получить клиент Supabase с anon ключом (для frontend)"""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key
    )
