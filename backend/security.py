import os
from datetime import datetime, timedelta, timezone

from jose import jwt
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 30
REFRESH_TOKEN_DAYS = 7


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return password_hash.verify(password, hashed_password)
    except Exception:
        return False


def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "type": "access", "exp": expires_at},
        os.environ["JWT_SECRET_KEY"],
        algorithm=JWT_ALGORITHM,
    )


def create_refresh_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "type": "refresh", "exp": expires_at},
        os.environ["JWT_SECRET_KEY"],
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str, expected_type: str) -> dict:
    payload = jwt.decode(token, os.environ["JWT_SECRET_KEY"], algorithms=[JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise ValueError("Invalid token type")
    return payload
