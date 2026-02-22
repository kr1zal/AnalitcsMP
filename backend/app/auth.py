"""
JWT-аутентификация через Supabase Auth (JWKS verification).
Поддерживает ES256 (новые Supabase проекты) и HS256 (legacy).
"""
import hmac
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import get_settings

security = HTTPBearer(auto_error=False)

# JWKS client — кэширует ключи автоматически
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


@dataclass
class CurrentUser:
    id: str
    email: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    """
    FastAPI dependency: верифицирует JWT из Authorization header.
    Возвращает CurrentUser(id, email).
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")

    token = credentials.credentials
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    user_id = payload.get("sub")
    email = payload.get("email", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")

    return CurrentUser(id=user_id, email=email)


async def get_current_user_or_cron(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    """
    FastAPI dependency для sync endpoints:
    - JWT Bearer → обычный пользователь
    - X-Cron-Secret + X-Cron-User-Id → cron-задача с сервера
    """
    # 1) Проверяем X-Cron-Secret
    cron_secret = (request.headers.get("x-cron-secret") or "").strip()
    if cron_secret:
        settings = get_settings()
        expected = (settings.sync_cron_secret or "").strip()
        if not expected:
            raise HTTPException(status_code=401, detail="Cron secret not configured on server")
        if not hmac.compare_digest(cron_secret.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="Invalid cron secret")

        user_id = (request.headers.get("x-cron-user-id") or "").strip()
        if not user_id:
            raise HTTPException(status_code=400, detail="X-Cron-User-Id header required for cron")
        return CurrentUser(id=user_id, email="cron@system")

    # 2) Fallback: JWT
    return await get_current_user(credentials)
