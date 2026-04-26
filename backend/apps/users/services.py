from datetime import timedelta

from django.db.models import Sum, Avg, Count
from django.utils import timezone

from apps.users.models import User, OTPCode, UserSession, UserProfile
from apps.bookings.models import Booking
from apps.reviews.models import Review
from common.jwt_utils import (
    generate_access_token,
    generate_refresh_token,
    hash_token,
    decode_token,
    REFRESH_TOKEN_LIFETIME_DAYS,
)
from common.utils import get_display_name
from third_party.otp import generate_otp, send_otp as send_otp_sms

OTP_RATE_LIMIT_PER_HOUR = 5
OTP_EXPIRY_MINUTES = 5


class AuthServiceError(Exception):
    """Raised when auth business logic fails."""

    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


# ─── Auth services ───────────────────────────────────────────

def send_otp_to_phone(phone_number: str, country_code: str) -> dict:
    """
    Finds or creates user, generates OTP, sends via SMS.
    Returns response dict or raises AuthServiceError.
    """
    full_phone = f"{country_code}{phone_number}"

    # Rate limit
    one_hour_ago = timezone.now() - timedelta(hours=1)
    recent_count = OTPCode.objects.filter(
        phone=full_phone, created_at__gte=one_hour_ago
    ).count()

    if recent_count >= OTP_RATE_LIMIT_PER_HOUR:
        raise AuthServiceError(
            "Too many OTP requests. Please try again later.",
            "RATE_LIMITED",
            status_code=429,
        )

    # Find or create user
    user, _ = User.objects.get_or_create(
        phone_number=phone_number,
        phone_country_code=country_code,
        defaults={"status": User.Status.ACTIVE},
    )

    if user.status != User.Status.ACTIVE:
        raise AuthServiceError(
            "Your account is not active. Please contact support.",
            "ACCOUNT_INACTIVE",
            status_code=403,
        )

    # Generate and store OTP
    otp_code = generate_otp(length=6)
    OTPCode.objects.create(
        user=user,
        phone=full_phone,
        otp_hash=OTPCode.hash_otp(otp_code),
        expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )

    # Send SMS
    if not send_otp_sms(full_phone, otp_code):
        raise AuthServiceError(
            "Failed to send OTP. Please try again.",
            "OTP_SEND_FAILED",
            status_code=500,
        )

    return {
        "message": "OTP sent successfully",
        "phone": full_phone,
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
    }


def verify_otp_and_login(phone_number: str, country_code: str, otp_code: str, request_meta: dict) -> dict:
    """
    Verifies OTP, creates session, returns tokens.
    Returns response dict or raises AuthServiceError.
    """
    full_phone = f"{country_code}{phone_number}"

    # Find user
    try:
        user = User.objects.get(
            phone_number=phone_number,
            phone_country_code=country_code,
        )
    except User.DoesNotExist:
        raise AuthServiceError("No account found for this phone number.", "USER_NOT_FOUND", 404)

    # Find latest OTP
    otp_record = (
        OTPCode.objects.filter(phone=full_phone, is_consumed=False)
        .order_by("-created_at")
        .first()
    )

    if not otp_record:
        raise AuthServiceError("No OTP found. Please request a new one.", "OTP_NOT_FOUND")

    if otp_record.is_expired:
        raise AuthServiceError("OTP has expired. Please request a new one.", "OTP_EXPIRED")

    if otp_record.is_max_attempts:
        raise AuthServiceError("Too many incorrect attempts. Please request a new OTP.", "MAX_ATTEMPTS")

    # Verify
    if not otp_record.verify(otp_code):
        remaining = max(otp_record.max_attempts - otp_record.attempt_count, 0)
        raise AuthServiceError(
            "Incorrect OTP. Please try again.",
            "INVALID_OTP",
        )

    # Update user
    is_first_login = user.phone_verified_at is None
    user.phone_verified_at = timezone.now()
    user.last_login_at = timezone.now()
    user.save(update_fields=["phone_verified_at", "last_login_at", "updated_at"])

    # Create session + tokens
    session = UserSession.objects.create(
        user=user,
        refresh_token_hash="",
        device_name=request_meta.get("device_name", ""),
        device_os=request_meta.get("device_os", ""),
        ip_address=request_meta.get("ip_address", ""),
        expires_at=timezone.now() + timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
    )

    access_token = generate_access_token(user.id)
    refresh_token = generate_refresh_token(user.id, session.id)

    session.refresh_token_hash = hash_token(refresh_token)
    session.save(update_fields=["refresh_token_hash"])

    return {
        "message": "OTP verified successfully",
        "tokens": {"access": access_token, "refresh": refresh_token},
        "is_new_user": is_first_login,
        "is_profile_complete": user.is_profile_complete,
    }


def complete_user_profile(user: User, data: dict) -> dict:
    """Creates or updates user profile. Returns response dict."""
    profile, _ = UserProfile.objects.update_or_create(
        user=user,
        defaults={
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "email": data.get("email") or None,
            "gender": data["gender"],
            "city": data["city"],
        },
    )

    if not user.is_profile_complete:
        user.is_profile_complete = True
        user.save(update_fields=["is_profile_complete", "updated_at"])

    return {
        "user_id": str(user.id),
        "display_name": profile.display_name,
        "is_profile_complete": True,
    }


def refresh_access_token(refresh_token_str: str) -> dict:
    """Validates refresh token, returns new access token. Raises AuthServiceError."""
    import jwt as pyjwt

    try:
        payload = decode_token(refresh_token_str)
    except pyjwt.ExpiredSignatureError:
        raise AuthServiceError("Refresh token has expired. Please log in again.", "REFRESH_EXPIRED", 401)
    except pyjwt.InvalidTokenError:
        raise AuthServiceError("Invalid refresh token.", "INVALID_REFRESH", 401)

    if payload.get("type") != "refresh":
        raise AuthServiceError("Invalid token type.", "INVALID_TOKEN_TYPE", 401)

    session_id = payload.get("session_id")
    user_id = payload.get("user_id")

    try:
        session = UserSession.objects.get(id=session_id, user_id=user_id)
    except UserSession.DoesNotExist:
        raise AuthServiceError("Session not found.", "SESSION_NOT_FOUND", 401)

    if not session.is_active:
        raise AuthServiceError("Session has been revoked or expired.", "SESSION_INACTIVE", 401)

    if session.refresh_token_hash != hash_token(refresh_token_str):
        session.revoke()
        raise AuthServiceError("Invalid refresh token. Session revoked.", "TOKEN_MISMATCH", 401)

    new_access_token = generate_access_token(user_id)
    session.save(update_fields=["last_active_at"])

    return {"access": new_access_token}


# ─── Dashboard services ──────────────────────────────────────

def get_host_dashboard(user: User) -> dict:
    """Computes all dashboard data for a host."""
    today = timezone.now().date()
    month_start = today.replace(day=1)

    greeting_name = _get_greeting_name(user)
    month_stats = _get_month_stats(user, month_start, today)
    today_activity = _get_today_activity(user, today)

    return {
        "greeting_name": greeting_name,
        "this_month": month_stats,
        "today": today_activity,
    }


def _get_greeting_name(user: User) -> str:
    try:
        return user.profile.first_name
    except UserProfile.DoesNotExist:
        return "Host"


def _get_month_stats(user: User, month_start, today) -> dict:
    month_bookings = Booking.objects.filter(
        host_user=user,
        check_in_date__gte=month_start,
        status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
    )

    agg = month_bookings.aggregate(
        earnings=Sum("total_host_receives"),
        count=Count("id"),
    )
    earnings = float(agg["earnings"] or 0)
    booking_count = agg["count"]

    # Occupancy
    days_in_month = (today - month_start).days + 1
    booked_nights = sum(
        max((min(b.check_out_date, today) - max(b.check_in_date, month_start)).days, 0)
        for b in month_bookings
    )
    occupancy_pct = round((booked_nights / days_in_month) * 100) if days_in_month > 0 else 0

    # Rating
    review_agg = Review.objects.filter(
        reviewee_user=user,
        review_type=Review.ReviewType.GUEST_TO_HOST,
    ).aggregate(avg=Avg("overall_rating"), count=Count("id"))

    avg_rating = round(review_agg["avg"], 1) if review_agg["avg"] else None

    # Response rate
    total_requests = Booking.objects.filter(
        host_user=user, booking_mode=Booking.BookingMode.REQUEST
    ).count()
    responded = Booking.objects.filter(
        host_user=user, booking_mode=Booking.BookingMode.REQUEST, host_responded_at__isnull=False
    ).count()
    response_rate = round((responded / total_requests) * 100) if total_requests > 0 else 100

    return {
        "earnings": earnings,
        "bookings": booking_count,
        "occupancy_pct": occupancy_pct,
        "occupancy_nights_booked": booked_nights,
        "occupancy_nights_total": days_in_month,
        "avg_rating": float(avg_rating) if avg_rating else None,
        "review_count": review_agg["count"],
        "response_rate_pct": response_rate,
    }


def _get_today_activity(user: User, today) -> dict:
    check_ins = [
        {
            "booking_code": b.booking_code,
            "guest_name": get_display_name(b.guest_user),
            "nights": b.nights,
            "check_in_time": "3 PM",
        }
        for b in Booking.objects.filter(
            host_user=user,
            check_in_date=today,
            status__in=[Booking.Status.ACCEPTED, Booking.Status.ACTIVE],
        ).select_related("guest_user")
    ]

    check_outs = [
        {
            "booking_code": b.booking_code,
            "guest_name": get_display_name(b.guest_user),
        }
        for b in Booking.objects.filter(
            host_user=user, check_out_date=today, status=Booking.Status.ACTIVE
        ).select_related("guest_user")
    ]

    recent_reviews = [
        {
            "reviewer_name": get_display_name(r.reviewer_user),
            "rating": r.overall_rating,
            "body": (r.body or "")[:100],
            "submitted_at": r.submitted_at.isoformat(),
        }
        for r in Review.objects.filter(
            reviewee_user=user, review_type=Review.ReviewType.GUEST_TO_HOST
        ).select_related("reviewer_user").order_by("-submitted_at")[:3]
    ]

    return {
        "check_ins": check_ins,
        "check_outs": check_outs,
        "recent_reviews": recent_reviews,
    }