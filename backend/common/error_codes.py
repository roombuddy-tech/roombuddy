"""
Centralized error codes used in API responses.

All error responses follow the shape:
    { "error": "<human readable>", "code": "<ErrorCode constant>" }

Frontend can switch on `code` for i18n/UX without depending on the
human-readable message.
"""


class ErrorCode:
    # ── Generic ──────────────────────────────────────────────
    NOT_FOUND = "NOT_FOUND"
    FORBIDDEN = "FORBIDDEN"
    INVALID_STATE = "INVALID_STATE"

    # ── Bookings ─────────────────────────────────────────────
    INVALID_DATES = "INVALID_DATES"
    PAST_DATE = "PAST_DATE"
    MIN_NIGHTS = "MIN_NIGHTS"
    MAX_NIGHTS = "MAX_NIGHTS"
    LISTING_NOT_FOUND = "LISTING_NOT_FOUND"
    SELF_BOOKING = "SELF_BOOKING"
    BOOKING_CONFLICT = "BOOKING_CONFLICT"

    # ── Payments ─────────────────────────────────────────────
    ALREADY_PAID = "ALREADY_PAID"
    GATEWAY_ERROR = "GATEWAY_ERROR"
    BAD_SIGNATURE = "BAD_SIGNATURE"
    PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND"
