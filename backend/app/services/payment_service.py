"""
YooKassa Payment Service — обёртка над API ЮКассы через httpx.
Создание платежей, проверка статуса, верификация webhook IP.
"""
import logging
from ipaddress import ip_address, ip_network
from uuid import uuid4

import httpx

from ..config import get_settings
from ..plans import PLANS

logger = logging.getLogger(__name__)

YOOKASSA_API = "https://api.yookassa.ru/v3"

# IP-адреса, с которых ЮКасса отправляет webhook уведомления
YOOKASSA_WEBHOOK_IPS = [
    ip_network("185.71.76.0/27"),
    ip_network("185.71.77.0/27"),
    ip_network("77.75.153.0/25"),
    ip_network("77.75.154.128/25"),
    ip_network("77.75.156.11/32"),
    ip_network("77.75.156.35/32"),
    ip_network("2a02:5180::/32"),
]


def _auth() -> tuple[str, str]:
    """Basic auth credentials для ЮКассы."""
    settings = get_settings()
    return (settings.yookassa_shop_id, settings.yookassa_secret_key)


def verify_webhook_ip(client_ip: str) -> bool:
    """Проверяет, что IP отправителя входит в whitelist ЮКассы."""
    try:
        addr = ip_address(client_ip)
        return any(addr in net for net in YOOKASSA_WEBHOOK_IPS)
    except ValueError:
        logger.warning(f"Invalid IP address in webhook: {client_ip}")
        return False


async def create_payment(user_id: str, plan: str) -> dict:
    """
    Создаёт платёж в ЮКассе с редиректом на платёжную форму.
    Сохраняет payment_method для будущих автоплатежей.

    Returns: полный ответ ЮКассы (id, status, confirmation.confirmation_url и т.д.)
    """
    settings = get_settings()
    plan_config = PLANS.get(plan)
    if not plan_config or plan_config["price_rub"] == 0:
        raise ValueError(f"Invalid or free plan: {plan}")

    price = str(plan_config["price_rub"]) + ".00"
    return_url = f"{settings.frontend_url}/settings?payment=success"

    payload = {
        "amount": {
            "value": price,
            "currency": "RUB",
        },
        "confirmation": {
            "type": "redirect",
            "return_url": return_url,
        },
        "capture": True,
        "save_payment_method": True,
        "description": f"Подписка RevioMP {plan_config['name']} — 1 месяц",
        "metadata": {
            "user_id": user_id,
            "plan": plan,
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{YOOKASSA_API}/payments",
            json=payload,
            auth=_auth(),
            headers={
                "Idempotence-Key": str(uuid4()),
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    if resp.status_code not in (200, 201):
        logger.error(f"YooKassa create_payment failed: {resp.status_code} {resp.text}")
        raise RuntimeError(f"YooKassa error: {resp.status_code}")

    data = resp.json()
    logger.info(f"Payment created: {data['id']} for user {user_id}, plan {plan}")
    return data


async def create_auto_payment(payment_method_id: str, plan: str, user_id: str) -> dict:
    """
    Создаёт автоплатёж через сохранённый payment_method (без подтверждения пользователя).
    Требует одобрения менеджера ЮКассы для production.
    """
    plan_config = PLANS.get(plan)
    if not plan_config or plan_config["price_rub"] == 0:
        raise ValueError(f"Invalid or free plan: {plan}")

    price = str(plan_config["price_rub"]) + ".00"

    payload = {
        "amount": {
            "value": price,
            "currency": "RUB",
        },
        "capture": True,
        "payment_method_id": payment_method_id,
        "description": f"Автопродление RevioMP {plan_config['name']}",
        "metadata": {
            "user_id": user_id,
            "plan": plan,
            "type": "auto_renewal",
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{YOOKASSA_API}/payments",
            json=payload,
            auth=_auth(),
            headers={
                "Idempotence-Key": str(uuid4()),
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    if resp.status_code not in (200, 201):
        logger.error(f"YooKassa auto_payment failed: {resp.status_code} {resp.text}")
        raise RuntimeError(f"YooKassa error: {resp.status_code}")

    data = resp.json()
    logger.info(f"Auto-payment created: {data['id']} for user {user_id}")
    return data


async def get_payment(payment_id: str) -> dict:
    """Получает текущий статус платежа из ЮКассы (для двойной верификации webhook)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{YOOKASSA_API}/payments/{payment_id}",
            auth=_auth(),
            timeout=15.0,
        )

    if resp.status_code != 200:
        logger.error(f"YooKassa get_payment failed: {resp.status_code} {resp.text}")
        raise RuntimeError(f"YooKassa error: {resp.status_code}")

    return resp.json()
