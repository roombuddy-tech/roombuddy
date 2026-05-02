"""
Redis utilities for distributed locking and idempotency.

Two utilities used by the booking + payment service:
- distributed_lock(): prevents two guests from booking the same dates simultaneously
- idempotency_seen(): prevents the same Razorpay event being processed twice

Configuration: `REDIS_URL` in settings (loaded from .env). If empty or Redis is
unreachable, an in-memory fallback is used. The fallback is single-process only
and is intended for local dev — a warning is logged on startup.
"""
import logging
import threading
import time
from contextlib import contextmanager

from django.conf import settings

logger = logging.getLogger(__name__)


# Single shared client built lazily
_redis_client = None
_redis_lock = threading.Lock()

# In-memory fallback for local dev without Redis
_memory_store: dict[str, tuple[str, float]] = {}
_memory_lock = threading.Lock()


# Internal Redis client connection timeout. Higher than typical to allow for
# managed-service cold starts (ElastiCache Serverless can take a moment).
_REDIS_SOCKET_TIMEOUT_SECONDS = 2


def _get_client():
    """Lazy-init shared Redis client. Returns None if Redis is unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    redis_url = settings.REDIS_URL
    if not redis_url:
        return None

    with _redis_lock:
        if _redis_client is not None:
            return _redis_client
        try:
            import redis
            client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=_REDIS_SOCKET_TIMEOUT_SECONDS,
            )
            client.ping()
            _redis_client = client
            logger.info(f"Connected to Redis at {redis_url}")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}); using in-memory fallback")
            _redis_client = None
    return _redis_client


def _set_nx(key: str, value: str, ttl_seconds: int) -> bool:
    """SET if Not eXists with TTL. Returns True if the key was set."""
    client = _get_client()
    if client is not None:
        try:
            return bool(client.set(key, value, nx=True, ex=ttl_seconds))
        except Exception as e:
            logger.error(f"Redis SET NX failed for {key}: {e}")

    # Fallback: in-memory
    now = time.monotonic()
    with _memory_lock:
        existing = _memory_store.get(key)
        if existing and existing[1] > now:
            return False
        _memory_store[key] = (value, now + ttl_seconds)
        return True


def _get_value(key: str) -> str | None:
    client = _get_client()
    if client is not None:
        try:
            return client.get(key)
        except Exception as e:
            logger.error(f"Redis GET failed for {key}: {e}")

    now = time.monotonic()
    with _memory_lock:
        existing = _memory_store.get(key)
        if existing and existing[1] > now:
            return existing[0]
        return None


def _delete(key: str) -> None:
    client = _get_client()
    if client is not None:
        try:
            client.delete(key)
            return
        except Exception as e:
            logger.error(f"Redis DEL failed for {key}: {e}")

    with _memory_lock:
        _memory_store.pop(key, None)


# ─── Public API ────────────────────────────────────────────────────────

@contextmanager
def distributed_lock(key: str, ttl_seconds: int | None = None):
    """
    Context manager for a distributed lock.

    Usage:
        with distributed_lock(f"booking:{listing_id}:{check_in}:{check_out}") as acquired:
            if not acquired:
                raise SomeoneElseIsBookingError
            ... safe section ...

    The lock auto-expires after `ttl_seconds` (or `BOOKING_LOCK_TTL_SECONDS`
    from settings) even if the process crashes.
    """
    if ttl_seconds is None:
        ttl_seconds = settings.BOOKING_LOCK_TTL_SECONDS

    token = f"lock_{time.time_ns()}"
    acquired = _set_nx(f"lock:{key}", token, ttl_seconds)
    try:
        yield acquired
    finally:
        if acquired:
            # Best-effort release. Safe even if the key already expired.
            current = _get_value(f"lock:{key}")
            if current == token:
                _delete(f"lock:{key}")


def idempotency_seen(event_id: str, ttl_seconds: int | None = None) -> bool:
    """
    Check whether we've already processed this event_id; mark as seen if not.

    Returns True if this is a duplicate (already processed).
    Returns False if this is the first time and we just recorded it.

    Used by the webhook handler to prevent duplicate Razorpay events from
    being processed twice. TTL must outlast the gateway's longest retry window.
    """
    if ttl_seconds is None:
        ttl_seconds = settings.WEBHOOK_IDEMPOTENCY_TTL_SECONDS

    key = f"idem:{event_id}"
    was_set = _set_nx(key, "1", ttl_seconds)
    return not was_set
