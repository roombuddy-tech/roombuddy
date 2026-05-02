"""
Redis utilities for distributed locking and idempotency.

Two utilities used by the booking + payment service:
- distributed_lock(): prevents two guests from booking the same dates simultaneously
- idempotency_check(): prevents the same Razorpay event being processed twice

ENV
───
REDIS_URL = redis://localhost:6379/0   (default for local dev)

If REDIS_URL is not set or Redis is unreachable, an in-memory fallback is used.
This is safe for local single-process dev only and logs a warning.
"""
import os
import time
import logging
import threading
from contextlib import contextmanager

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "")

# Single shared client built lazily
_redis_client = None
_redis_lock = threading.Lock()

# In-memory fallback for local dev without Redis
_memory_store: dict[str, tuple[str, float]] = {}
_memory_lock = threading.Lock()

print(f"🔍 REDIS_URL from env: {os.getenv('REDIS_URL', 'NOT SET')}")


def _get_client():
    """Lazy-init shared redis client. Returns None if Redis is unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    if not REDIS_URL:
        return None

    with _redis_lock:
        if _redis_client is not None:
            return _redis_client
        try:
            import redis
            client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2)
            client.ping()
            _redis_client = client
            logger.info(f"Connected to Redis at {REDIS_URL}")
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
        # Garbage-collect expired keys lazily
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
def distributed_lock(key: str, ttl_seconds: int = 300):
    """
    Context manager for a distributed lock.

    Usage:
        with distributed_lock(f"booking:{listing_id}:{check_in}:{check_out}") as acquired:
            if not acquired:
                raise SomeoneElseIsBookingError
            ... safe section ...

    The lock auto-expires after ttl_seconds even if the process crashes.
    """
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


def idempotency_seen(event_id: str, ttl_seconds: int = 7 * 24 * 3600) -> bool:
    """
    Check whether we've already processed this event_id; mark as seen if not.

    Returns True if this is a duplicate (already processed).
    Returns False if this is the first time and we just recorded it.

    Used by the webhook handler to prevent duplicate Razorpay events from
    being processed twice.
    """
    key = f"idem:{event_id}"
    was_set = _set_nx(key, "1", ttl_seconds)
    return not was_set