"""
Razorpay payment gateway integration.

Provider abstraction:
- 'console'  : local development fake gateway (no Razorpay account needed)
- 'razorpay' : real Razorpay API (test mode or live mode, controlled by which
               key id is configured)

All configuration is read from `django.conf.settings`, which loads from .env.
"""
import hashlib
import hmac
import logging
import time
import uuid
from decimal import Decimal

from django.conf import settings

from apps.payments.models import PaymentProvider
from common.constants import PAISE_PER_RUPEE

logger = logging.getLogger(__name__)


# Razorpay's `payment_capture: 1` means auto-capture authorized payments.
# Razorpay accepts `0` (manual capture) or `1` (auto). We always auto-capture.
RAZORPAY_AUTO_CAPTURE = 1

# Console-mode signature prefix — verified instead of HMAC for local dev.
_CONSOLE_PAYMENT_SIG_PREFIX = "console_sig_"
_CONSOLE_WEBHOOK_SIG = "console_webhook_sig"


# ─── Public API ──────────────────────────────────────────────────────────

def create_order(
    amount: Decimal,
    currency: str,
    receipt: str,
    notes: dict | None = None,
    expire_in_minutes: int | None = None,
) -> dict:
    """
    Create a payment order. Amount is in rupees; we convert to paise internally.

    `expire_in_minutes` is informational only at the gateway level — RoomBuddy
    enforces its own expiry via `booking.expires_at`. This argument is kept so
    callers can document intent.
    """
    amount_paise = int(Decimal(amount) * PAISE_PER_RUPEE)
    provider = settings.PAYMENT_PROVIDER

    if provider == PaymentProvider.CONSOLE:
        return _create_order_console(amount_paise, currency, receipt, notes, expire_in_minutes)
    if provider == PaymentProvider.RAZORPAY:
        return _create_order_razorpay(amount_paise, currency, receipt, notes)

    logger.error(f"Unknown payment provider: {provider}")
    raise ValueError(f"Unknown payment provider: {provider}")


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """
    Verify the HMAC signature returned after a successful checkout.
    Razorpay computes this as HMAC_SHA256(order_id|payment_id, key_secret).
    """
    if settings.PAYMENT_PROVIDER == PaymentProvider.CONSOLE:
        return signature.startswith(_CONSOLE_PAYMENT_SIG_PREFIX)

    if not settings.RAZORPAY_KEY_SECRET:
        logger.error("RAZORPAY_KEY_SECRET not configured")
        return False

    payload = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(), payload, hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Verify the signature on an incoming webhook from Razorpay."""
    if settings.PAYMENT_PROVIDER == PaymentProvider.CONSOLE:
        return signature == _CONSOLE_WEBHOOK_SIG

    if not settings.RAZORPAY_WEBHOOK_SECRET:
        logger.error("RAZORPAY_WEBHOOK_SECRET not configured")
        return False

    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def fetch_payment(payment_id: str) -> dict | None:
    """Fetch a payment by id. Used by reconciliation jobs."""
    if settings.PAYMENT_PROVIDER == PaymentProvider.CONSOLE:
        return {"id": payment_id, "status": "captured", "amount": 0}

    client = _build_client()
    if client is None:
        return None
    try:
        return client.payment.fetch(payment_id)
    except Exception as e:
        logger.error(f"Error fetching payment {payment_id}: {e}")
        return None


def create_refund(payment_id: str, amount: Decimal, notes: dict | None = None) -> dict | None:
    """Create a refund against a captured payment. Amount in rupees."""
    amount_paise = int(Decimal(amount) * PAISE_PER_RUPEE)

    if settings.PAYMENT_PROVIDER == PaymentProvider.CONSOLE:
        refund_id = f"rfnd_console_{uuid.uuid4().hex[:12]}"
        logger.info(f"[CONSOLE REFUND] {refund_id} for {payment_id}: ₹{amount}")
        return {
            "id": refund_id,
            "payment_id": payment_id,
            "amount": amount_paise,
            "status": "processed",
        }

    client = _build_client()
    if client is None:
        return None
    try:
        return client.payment.refund(
            payment_id, {"amount": amount_paise, "notes": notes or {}},
        )
    except Exception as e:
        logger.error(f"Error creating refund for {payment_id}: {e}")
        return None


# ─── Private helpers ─────────────────────────────────────────────────────

def _build_client():
    """Build a Razorpay SDK client. Returns None if SDK unavailable or unconfigured."""
    try:
        import razorpay
    except ImportError:
        logger.error("razorpay package not installed. Run: pip install razorpay")
        return None

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        logger.error("Razorpay credentials not configured")
        return None

    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def _create_order_console(amount_paise, currency, receipt, notes, expire_in_minutes):
    """In console mode, fake an order so local dev works end-to-end."""
    order_id = f"order_console_{uuid.uuid4().hex[:14]}"
    expire_by = int(time.time()) + (expire_in_minutes * 60) if expire_in_minutes else None
    logger.info(
        f"[CONSOLE RAZORPAY] Order {order_id} created: "
        f"₹{amount_paise / PAISE_PER_RUPEE:.2f} {currency}, receipt={receipt}",
    )
    return {
        "id": order_id,
        "amount": amount_paise,
        "currency": currency,
        "receipt": receipt,
        "status": "created",
        "notes": notes or {},
        **({"expire_by": expire_by} if expire_by is not None else {}),
    }


def _create_order_razorpay(amount_paise, currency, receipt, notes):
    """Call the real Razorpay orders API."""
    client = _build_client()
    if client is None:
        raise RuntimeError("Razorpay client could not be constructed")

    return client.order.create({
        "amount": amount_paise,
        "currency": currency,
        "receipt": receipt,
        "notes": notes or {},
        "payment_capture": RAZORPAY_AUTO_CAPTURE,
    })
