"""
Domain constants used across booking and payment flows.

These are pure business-logic values that don't change per environment.
Things that DO change per environment (timeouts, payment provider, etc.) live
in `config/settings.py` and are read via `django.conf.settings`.
"""
from decimal import Decimal


# ── Money ────────────────────────────────────────────────────
DEFAULT_CURRENCY = "INR"
MONEY_PRECISION = Decimal("0.01")           # round to paise
PERCENT_DENOMINATOR = Decimal("100")
PAISE_PER_RUPEE = 100                        # for gateway amount conversion


# ── Refund policy ────────────────────────────────────────────
# Tiered refund schedule per cancellation policy. The keys are days remaining
# until check-in; the value is the % refunded as a Decimal in [0, 1].
#
# Evaluation: walk thresholds top-down (highest days first); first match wins.
# E.g. for FLEXIBLE: 2+ days → 100%, otherwise → 50%.
REFUND_SCHEDULES = {
    "flexible": [
        (2, Decimal("1.00")),   # 100% if 2+ days to check-in
        (0, Decimal("0.50")),   # 50% otherwise
    ],
    "moderate": [
        (7, Decimal("1.00")),   # 100% if 7+ days
        (2, Decimal("0.50")),   # 50% if 2-6 days
        (0, Decimal("0.00")),   # 0% otherwise
    ],
    "strict": [
        (7, Decimal("0.50")),   # 50% if 7+ days
        (0, Decimal("0.00")),   # 0% otherwise
    ],
}
DEFAULT_CANCELLATION_POLICY = "moderate"


# ── Webhook handling ─────────────────────────────────────────
WEBHOOK_DEFAULT_EVENT_TYPE = "unknown"


# ── Booking codes ────────────────────────────────────────────
BOOKING_CODE_PREFIX = "RB-"
BOOKING_CODE_LENGTH = 8                      # chars after the prefix


# ── Standard log/history reasons ─────────────────────────────
class StatusChangeReason:
    """Human-readable reasons for BookingStatusHistory entries."""
    BOOKING_CREATED = "Booking created"
    AUTO_ACCEPT_INSTANT = "Auto-accepted on instant booking payment"
    PAYMENT_FAILED = "Payment failed"
    PAYMENT_WINDOW_EXPIRED = "Payment not completed within window (auto-expired by cron)"
    CANCELLED_BY_GUEST = "Cancelled by guest"
    CANCELLED_BY_HOST = "Cancelled by host"
    CANCELLED_BY_SYSTEM = "Cancelled by system"
