"""
Fernet encryption for marketplace API tokens.
Key is loaded from FERNET_KEY env var.
"""
from cryptography.fernet import Fernet
from .config import get_settings


def _get_fernet() -> Fernet:
    key = get_settings().fernet_key
    if not key:
        raise RuntimeError("FERNET_KEY not set in .env")
    return Fernet(key.encode())


def encrypt_token(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    return _get_fernet().decrypt(ciphertext.encode()).decode()
