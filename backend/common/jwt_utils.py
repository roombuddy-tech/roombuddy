import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt # type: ignore
from django.conf import settings

# Token lifetimes (configurable via settings or env)
ACCESS_TOKEN_LIFETIME_MINUTES = getattr(settings, "ACCESS_TOKEN_LIFETIME_MINUTES", 30)
REFRESH_TOKEN_LIFETIME_DAYS = getattr(settings, "REFRESH_TOKEN_LIFETIME_DAYS", 30)

ALGORITHM = "HS256"


def _get_secret_key() -> str:
    return settings.SECRET_KEY


def generate_access_token(user_id: str) -> str:
    """Generate a short-lived access token (default 30 min)."""
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_LIFETIME_MINUTES),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def generate_refresh_token(user_id: str, session_id: str) -> str:
    """Generate a long-lived refresh token (default 30 days)."""
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": str(user_id),
        "session_id": str(session_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    Raises jwt.ExpiredSignatureError if expired.
    Raises jwt.InvalidTokenError for any other issue.
    """
    return jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])


def hash_token(token: str) -> str:
    """SHA-256 hash of a token (for storing refresh tokens in DB)."""
    return hashlib.sha256(token.encode()).hexdigest()