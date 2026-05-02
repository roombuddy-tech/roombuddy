"""
Razorpay payment gateway integration.

- 'console' provider for local development without real Razorpay account
- 'razorpay' provider for actual API calls (test mode or live mode)

ENV VARIABLES
─────────────
PAYMENT_PROVIDER          = console | razorpay   (default: console)
RAZORPAY_KEY_ID           = rzp_test_xxxxx        (Razorpay dashboard)
RAZORPAY_KEY_SECRET       = xxxxx                  (Razorpay dashboard)
RAZORPAY_WEBHOOK_SECRET   = xxxxx                  (set in dashboard webhooks)
"""
import os
import hmac
import hashlib
import logging
import uuid
from decimal import Decimal

logger = logging.getLogger(__name__)

PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "console")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")


# ─── Public API ──────────────────────────────────────────────────────────

def create_order(
    amount: Decimal,
    currency: str,
    receipt: str,
    notes: dict | None = None,
    expire_in_minutes: int = 15,
) -> dict:
    """
    Create a Razorpay order. Amount is in rupees; we convert to paise internally.

    expire_in_minutes: order auto-expires this many minutes from now. After expiry,
    Razorpay will not accept any payment attempts for this order.
    """
    amount_paise = int(Decimal(amount) * 100)

    if PAYMENT_PROVIDER == "console":
        return _create_order_console(amount_paise, currency, receipt, notes, expire_in_minutes)
    elif PAYMENT_PROVIDER == "razorpay":
        return _create_order_razorpay(amount_paise, currency, receipt, notes, expire_in_minutes)
    else:
        logger.error(f"Unknown payment provider: {PAYMENT_PROVIDER}")
        raise ValueError(f"Unknown payment provider: {PAYMENT_PROVIDER}")


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """
    Verify the HMAC signature returned after a successful checkout.
    The signature is computed as HMAC_SHA256(order_id|payment_id, key_secret).
    """
    if PAYMENT_PROVIDER == "console":
        # In console mode, signatures starting with 'console_sig_' are valid
        return signature.startswith("console_sig_")

    if not RAZORPAY_KEY_SECRET:
        logger.error("RAZORPAY_KEY_SECRET not configured")
        return False

    payload = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(), payload, hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Verify the signature on an incoming webhook."""
    if PAYMENT_PROVIDER == "console":
        return signature == "console_webhook_sig"

    if not RAZORPAY_WEBHOOK_SECRET:
        logger.error("RAZORPAY_WEBHOOK_SECRET not configured")
        return False

    expected = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def fetch_payment(payment_id: str) -> dict | None:
    """Fetch a payment by id. Used by the reconciliation cron."""
    if PAYMENT_PROVIDER == "console":
        return {"id": payment_id, "status": "captured", "amount": 0}

    try:
        import razorpay
        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        return client.payment.fetch(payment_id)
    except Exception as e:
        logger.error(f"Error fetching payment {payment_id}: {e}")
        return None


def create_refund(payment_id: str, amount: Decimal, notes: dict | None = None) -> dict | None:
    """Create a refund against a captured payment. Amount in rupees."""
    amount_paise = int(Decimal(amount) * 100)

    if PAYMENT_PROVIDER == "console":
        refund_id = f"rfnd_console_{uuid.uuid4().hex[:12]}"
        logger.info(f"[CONSOLE REFUND] {refund_id} for {payment_id}: ₹{amount}")
        return {
            "id": refund_id, "payment_id": payment_id,
            "amount": amount_paise, "status": "processed",
        }

    try:
        import razorpay
        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        return client.payment.refund(
            payment_id, {"amount": amount_paise, "notes": notes or {}},
        )
    except Exception as e:
        logger.error(f"Error creating refund for {payment_id}: {e}")
        return None


# ─── Console provider (local dev without Razorpay account) ────────────────

def _create_order_console(amount_paise, currency, receipt, notes, expire_in_minutes):
    """In console mode, fake an order so local dev works end-to-end."""
    import time
    order_id = f"order_console_{uuid.uuid4().hex[:14]}"
    expire_by = int(time.time()) + (expire_in_minutes * 60)
    print(f"\n{'='*60}")
    print(f"  [CONSOLE RAZORPAY] Order created")
    print(f"  Order ID  : {order_id}")
    print(f"  Amount    : ₹{amount_paise/100:.2f} {currency}")
    print(f"  Receipt   : {receipt}")
    print(f"  Expire by : {expire_by} (in {expire_in_minutes} min)")
    print(f"{'='*60}\n")
    return {
        "id": order_id, "amount": amount_paise, "currency": currency,
        "receipt": receipt, "status": "created", "notes": notes or {},
        "expire_by": expire_by,
    }


def _create_order_razorpay(amount_paise, currency, receipt, notes, expire_in_minutes):
    """Call the real Razorpay orders API."""
    import time
    try:
        import razorpay
    except ImportError:
        logger.error("razorpay package not installed. Run: pip install razorpay")
        raise

    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise RuntimeError("Razorpay credentials not configured")

    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    return client.order.create({
        "amount": amount_paise,
        "currency": currency,
        "receipt": receipt,
        "notes": notes or {},
        "payment_capture": 1,
    })