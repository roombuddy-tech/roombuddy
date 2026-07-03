from datetime import timedelta
import secrets
import uuid

from django.db import models
from django.db.models import Sum, Avg, Count
from django.utils import timezone

from apps.users.models import User, OTPCode, UserSession, UserProfile, EmailVerification
from apps.bookings.models import Booking
from apps.reviews.models import Review
from apps.users.models import PayoutAccount
from apps.listings.models import Listing
from django.conf import settings
from third_party.storage import get_photo_url
from third_party.email import send_verification_email
from third_party.storage import upload_image, delete_image, StorageError
from apps.notifications.models import EventType, NotificationChannel
from apps.notifications.services import dispatch

from common.jwt_utils import (
    generate_access_token,
    generate_refresh_token,
    hash_token,
    decode_token,
    REFRESH_TOKEN_LIFETIME_DAYS,
)
from common.utils import get_display_name, get_initials
from third_party.otp import (
    OTP_PROVIDER,
    generate_otp,
    send_otp as send_otp_sms,
    verify_otp as verify_otp_provider,
)
import logging
import jwt as pyjwt

logger = logging.getLogger(__name__)

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

def send_otp_to_phone(phone_number: str, country_code: str, mode: str = "auto") -> dict:
    logger.info("send_otp_to_phone country_code=%s mode=%s", country_code, mode)
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

    existing_user = User.objects.filter(
        phone_number=phone_number,
        phone_country_code=country_code,
    ).first()

    if mode == "login" and not existing_user:
        raise AuthServiceError(
            "No account found with this phone number.",
            "ACCOUNT_NOT_FOUND",
            status_code=404,
        )

    if mode == "signup" and existing_user:
        raise AuthServiceError(
            "An account already exists with this number. Please log in.",
            "ACCOUNT_EXISTS",
            status_code=409,
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

    # ── Reviewer bypass: skip real OTP for demo account ───────────────────
    if (phone_number == settings.REVIEW_PHONE_NUMBER
            and country_code == settings.REVIEW_COUNTRY_CODE):
        logger.info("send_otp: reviewer account — skipping real OTP")
        OTPCode.objects.create(
            user=user,
            phone=full_phone,
            otp_hash=OTPCode.hash_otp(settings.REVIEW_STATIC_OTP),
            expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        )
        return {"message": "OTP sent successfully", "phone": full_phone}


    if OTP_PROVIDER == "console":
        # Console mode: generate locally, store hash, send to console
        otp_code = generate_otp(length=6)
        OTPCode.objects.create(
            user=user,
            phone=full_phone,
            otp_hash=OTPCode.hash_otp(otp_code),
            expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        )
        if not send_otp_sms(full_phone, otp_code):
            raise AuthServiceError(
                "Failed to send OTP. Please try again.",
                "OTP_SEND_FAILED",
                status_code=500,
            )
    else:
        # MSG91 mode: MSG91 generates the OTP, we just track the request
        OTPCode.objects.create(
            user=user,
            phone=full_phone,
            expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        )
        if not send_otp_sms(full_phone):
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
    - console: verifies locally against stored hash
    - msg91:   verifies via MSG91 API
    """
    logger.info("verify_otp_and_login country_code=%s", country_code)
    full_phone = f"{country_code}{phone_number}"

    # Find user
    try:
        user = User.objects.get(
            phone_number=phone_number,
            phone_country_code=country_code,
        )
    except User.DoesNotExist:
        logger.warning("verify_otp_and_login: no account for %s%s", country_code, phone_number)
        raise AuthServiceError("No account found for this phone number.", "USER_NOT_FOUND", 404)


    if (phone_number == settings.REVIEW_PHONE_NUMBER
        and country_code == settings.REVIEW_COUNTRY_CODE
        and otp_code == settings.REVIEW_STATIC_OTP):
        logger.info("verify_otp: reviewer account — static OTP accepted")
        OTPCode.objects.filter(phone=full_phone, is_consumed=False).update(is_consumed=True)

    elif OTP_PROVIDER == "console":
        # Local hash verification
        otp_record = (
            OTPCode.objects.filter(phone=full_phone, is_consumed=False)
            .order_by("-created_at")
            .first()
        )

        if not otp_record:
            raise AuthServiceError("No OTP found. Please request a new one.", "OTP_NOT_FOUND")

        if otp_record.is_expired:
            logger.warning("verify_otp_and_login: OTP expired for %s%s", country_code, phone_number)
            raise AuthServiceError("OTP has expired. Please request a new one.", "OTP_EXPIRED")

        if otp_record.is_max_attempts:
            logger.warning("verify_otp_and_login: max attempts for %s%s", country_code, phone_number)
            raise AuthServiceError("Too many incorrect attempts. Please request a new OTP.", "MAX_ATTEMPTS")

        if not otp_record.verify(otp_code):
            logger.warning("verify_otp_and_login: incorrect OTP for %s%s", country_code, phone_number)
            raise AuthServiceError("Incorrect OTP. Please try again.", "INVALID_OTP")
    else:
        # MSG91 verification
        if not verify_otp_provider(full_phone, otp_code):
            logger.warning("verify_otp_and_login: provider rejected OTP for %s%s", country_code, phone_number)
            raise AuthServiceError("Invalid or expired OTP.", "INVALID_OTP")

        # Mark local tracking record as consumed (if it exists)
        otp_record = (
            OTPCode.objects.filter(phone=full_phone, is_consumed=False)
            .order_by("-created_at")
            .first()
        )
        if otp_record:
            otp_record.is_consumed = True
            otp_record.save(update_fields=["is_consumed"])

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
    """Creates or updates user profile. Email saved to users table."""
    logger.info("complete_user_profile user_id=%s", getattr(user, "id", None))
    email = data.get("email") or None

    if email:
        existing = User.objects.filter(email=email, email_verified_at__isnull=False).exclude(id=user.id).first()
        if existing:
            raise AuthServiceError("This email is already associated with another account.", "EMAIL_TAKEN", 409)

    profile, _ = UserProfile.objects.update_or_create(
        user=user,
        defaults={
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "gender": data["gender"],
            "city": data["city"],
        },
    )

    if "email" in data:
        new_email = data["email"] or None
        if new_email and new_email != user.email:
            if User.objects.filter(email=new_email).exclude(id=user.id).exists():
                raise AuthServiceError(
                    "This email is already associated with another account.",
                    "EMAIL_TAKEN",
                    409,
                )
            user.email = new_email
            user.email_verified_at = None
        elif not new_email and user.email:
            user.email = None
            user.email_verified_at = None

    # Always mark profile as complete
    user.is_profile_complete = True
    user.save(update_fields=["email", "email_verified_at", "is_profile_complete", "updated_at"])

    return {
        "user_id": str(user.id),
        "display_name": profile.display_name,
        "is_profile_complete": True,
    }


def refresh_access_token(refresh_token_str: str) -> dict:
    """Validates refresh token, returns new access token. Raises AuthServiceError."""

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


def get_user_profile(user: User) -> dict:
    """Returns full profile data for the profile menu."""
    try:
        profile = user.profile
        first_name = profile.first_name
        last_name = profile.last_name
        city = profile.city
        gender = profile.gender
        date_of_birth = profile.date_of_birth.isoformat() if profile.date_of_birth else None
        profile_photo_url = get_photo_url(profile.profile_photo_url) if profile.profile_photo_url else None
    except UserProfile.DoesNotExist:
        first_name = ""
        last_name = ""
        city = ""
        gender = ""
        date_of_birth = None
        profile_photo_url = None

    display_name = f"{first_name} {last_name}".strip() or "User"
    initials = (
        f"{first_name[0] if first_name else ''}{last_name[0] if last_name else ''}".upper() or "U"
    )
    member_since = user.created_at.strftime("%b %Y") if user.created_at else ""

    return {
        "user_id": str(user.id),
        "first_name": first_name,
        "last_name": last_name,
        "display_name": display_name,
        "initials": initials,
        "email": user.email or "",
        "profile_photo_url": profile_photo_url,
        "city": city,
        "gender": gender,
        "date_of_birth": date_of_birth,
        "phone_verified": user.phone_verified_at is not None,
        "email_verified": user.email_verified_at is not None,
        "aadhaar_verified": profile.id_verification_status == "approved" if profile else False,
        "member_since": member_since,
        "phone_number": user.phone_number,
        "phone_country_code": user.phone_country_code,
    }


def update_user_profile(user: User, data: dict) -> dict:
    """Updates profile fields. Email saved to users table."""
    logger.info("update_user_profile user_id=%s", getattr(user, "id", None))
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        raise AuthServiceError("Profile not found. Please complete your profile first.", "PROFILE_NOT_FOUND", 404)

    if "first_name" in data:
        profile.first_name = data["first_name"]
    if "last_name" in data:
        profile.last_name = data["last_name"]
    if "gender" in data:
        profile.gender = data["gender"]
    if "city" in data:
        profile.city = data["city"]
    if "date_of_birth" in data:
        profile.date_of_birth = data["date_of_birth"]
    profile.save()

    if "email" in data:
        new_email = data["email"] or None
        if new_email and new_email != user.email:
            if User.objects.filter(email=new_email).exclude(id=user.id).exists():
                raise AuthServiceError(
                    "This email is already associated with another account.",
                    "EMAIL_TAKEN",
                    409,
                )
            user.email = new_email
            user.email_verified_at = None
            user.save(update_fields=["email", "email_verified_at", "updated_at"])
        elif not new_email and user.email:
            user.email = None
            user.email_verified_at = None
            user.save(update_fields=["email", "email_verified_at", "updated_at"])

    return {
        "user_id": str(user.id),
        "display_name": profile.display_name,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": user.email or "",
        "gender": profile.gender,
        "city": profile.city,
        "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
    }


def get_public_user_profile(viewing_user: User, target_user_id: str) -> dict:
    """
    Public-facing profile of another user. Used when:
    - A host views a guest's profile (from a booking)
    - A guest views a host's profile (from a listing)
    """
    try:
        target = User.objects.select_related("profile").get(id=target_user_id)
    except User.DoesNotExist:
        raise AuthServiceError("User not found", "NOT_FOUND", 404)

    try:
        profile = target.profile
        first_name = profile.first_name
        last_name = profile.last_name
        city = profile.city
        profile_photo_url = get_photo_url(profile.profile_photo_url) if profile.profile_photo_url else None
    except UserProfile.DoesNotExist:
        first_name = ""
        last_name = ""
        city = ""
        profile_photo_url = None

    display_name = f"{first_name} {last_name}".strip() or "User"
    initials = (
        f"{first_name[0] if first_name else ''}{last_name[0] if last_name else ''}".upper()
        or "U"
    )

    stays_as_guest = Booking.objects.filter(
        guest_user=target,
        status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
    ).count()
    stays_as_host = Booking.objects.filter(
        host_user=target,
        status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
    ).count()

    reviews_qs = (
        Review.objects.filter(reviewee_user=target, is_hidden=False)
        .select_related("reviewer_user", "reviewer_user__profile")
        .order_by("-submitted_at")
    )

    review_count = reviews_qs.count()
    avg_rating = (
        reviews_qs.aggregate(avg=Avg("overall_rating"))["avg"]
        if review_count
        else None
    )

    recent_reviews = [
        {
            "id": str(r.id),
            "reviewer_name": get_display_name(r.reviewer_user),
            "reviewer_initials": get_initials(r.reviewer_user),
            "rating": r.overall_rating,
            "title": r.title,
            "body": r.body,
            "submitted_at": r.submitted_at.isoformat(),
            "review_type": r.review_type,
        }
        for r in reviews_qs[:10]
    ]

    member_since = target.created_at.strftime("%b %Y") if target.created_at else ""

    return {
        "user_id": str(target.id),
        "display_name": display_name,
        "first_name": first_name,
        "initials": initials,
        "city": city,
        "profile_photo_url": profile_photo_url,
        "member_since": member_since,
        "verification": {
            "phone_verified": target.phone_verified_at is not None,
            "email_verified": target.email_verified_at is not None,
            "aadhaar_verified": profile.id_verification_status == "approved" if profile else False,
        },
        "stats": {
            "stays_as_guest": stays_as_guest,
            "stays_as_host": stays_as_host,
            "review_count": review_count,
            "avg_rating": round(float(avg_rating), 1) if avg_rating is not None else None,
        },
        "recent_reviews": recent_reviews,
    }


def send_email_verification(user: User, email: str) -> dict:
    """Generates a verification token and sends it via email."""
    logger.info("send_email_verification user_id=%s email=%s", getattr(user, "id", None), email)
    existing = User.objects.filter(email=email, email_verified_at__isnull=False).exclude(id=user.id).first()
    if existing:
        raise AuthServiceError(
            "This email is already verified by another account.",
            "EMAIL_ALREADY_TAKEN",
            status_code=409,
        )

    one_hour_ago = timezone.now() - timedelta(hours=1)
    recent_count = EmailVerification.objects.filter(user=user, email=email, created_at__gte=one_hour_ago).count()

    if recent_count >= 5:
        raise AuthServiceError("Too many verification requests. Try again later.", "RATE_LIMITED", 429)

    token = secrets.token_urlsafe(32)
    EmailVerification.objects.create(
        user=user, email=email,
        token_hash=EmailVerification.hash_token(token),
        expires_at=timezone.now() + timedelta(hours=24),
    )

    if not send_verification_email(email, token, str(user.id)):
        raise AuthServiceError("Failed to send verification email. Please try again.", "EMAIL_SEND_FAILED", 500)

    return {"message": "Verification email sent", "email": email}


def verify_email_token(user: User, token: str) -> dict:
    """Verifies the email token. Updates users.email only."""
    logger.info("verify_email_token user_id=%s", getattr(user, "id", None))
    record = EmailVerification.objects.filter(user=user, is_consumed=False).order_by("-created_at").first()

    if not record:
        raise AuthServiceError("No pending verification found.", "NOT_FOUND", 404)
    if record.is_expired:
        raise AuthServiceError("Verification link has expired. Please request a new one.", "EXPIRED", 400)
    if not record.verify(token):
        raise AuthServiceError("Invalid verification token.", "INVALID_TOKEN", 400)

    user.email = record.email
    user.email_verified_at = timezone.now()
    user.save(update_fields=["email", "email_verified_at", "updated_at"])

    return {"message": "Email verified successfully", "email": record.email}


def get_verification_status(user: User) -> dict:
    """Returns verification status including ID verification."""
    profile = user.profile if hasattr(user, "profile") else None
    id_status = "not_submitted"
    id_rejection_reason = None
    id_submitted_at = None
    id_reviewed_at = None

    if profile:
        id_status = profile.id_verification_status
        id_rejection_reason = profile.id_rejection_reason
        id_submitted_at = profile.id_submitted_at.isoformat() if profile.id_submitted_at else None
        id_reviewed_at = profile.id_reviewed_at.isoformat() if profile.id_reviewed_at else None

    return {
        "phone_verified": user.phone_verified_at is not None,
        "phone": f"{user.phone_country_code}{user.phone_number}",
        "email_verified": user.email_verified_at is not None,
        "email": user.email or "",
        "aadhaar_verified": id_status == "approved",
        "id_verification_status": id_status,
        "id_rejection_reason": id_rejection_reason,
        "id_submitted_at": id_submitted_at,
        "id_reviewed_at": id_reviewed_at,
    }


def submit_id_verification(user: User, aadhaar_image, selfie_image) -> dict:
    """Upload Aadhaar photo + selfie for manual verification."""
    logger.info("submit_id_verification user_id=%s", getattr(user, "id", None))
    profile = user.profile

    if profile.id_verification_status == "approved":
        raise AuthServiceError("Your ID is already verified.", "ALREADY_VERIFIED", 400)

    aadhaar_result = upload_image(
        aadhaar_image,
        folder=f"id-verification/{user.id}",
        filename=f"aadhaar_{uuid.uuid4().hex[:8]}.jpg",
        max_width=1600,
    )

    selfie_result = upload_image(
        selfie_image,
        folder=f"id-verification/{user.id}",
        filename=f"selfie_{uuid.uuid4().hex[:8]}.jpg",
        max_width=1200,
    )

    profile.aadhaar_photo_url = aadhaar_result["url"]
    profile.selfie_photo_url = selfie_result["url"]
    profile.id_verification_status = UserProfile.IDVerificationStatus.PENDING
    profile.id_rejection_reason = None
    profile.id_submitted_at = timezone.now()
    profile.id_reviewed_at = None
    profile.id_reviewed_by = None
    profile.save(update_fields=[
        "aadhaar_photo_url", "selfie_photo_url",
        "id_verification_status", "id_rejection_reason",
        "id_submitted_at", "id_reviewed_at", "id_reviewed_by", "updated_at",
    ])

    return {"status": "pending", "message": "Documents submitted. We'll review within 24-48 hours."}


def review_id_verification(user_id: str, action: str, reviewer: str, reason: str = None) -> dict:
    """Approve or reject a user's ID verification."""
    logger.info("review_id_verification user_id=%s action=%s reason=%s", user_id, action, reason)
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise AuthServiceError("User not found.", "USER_NOT_FOUND", 404)

    profile = user.profile

    if profile.id_verification_status != "pending":
        raise AuthServiceError(
            f"Cannot review. Current status is '{profile.id_verification_status}'.",
            "INVALID_STATUS", 400,
        )

    promoted_count = 0
    if action == "approve":
        profile.id_verification_status = UserProfile.IDVerificationStatus.APPROVED
        profile.id_rejection_reason = None
        promoted_count = Listing.objects.filter(
            host_user=user, status=Listing.Status.PENDING,
        ).update(status=Listing.Status.LIVE, published_at=timezone.now())
    elif action == "reject":
        if not reason:
            raise AuthServiceError("Rejection reason is required.", "REASON_REQUIRED", 400)
        profile.id_verification_status = UserProfile.IDVerificationStatus.REJECTED
        profile.id_rejection_reason = reason
        Listing.objects.filter(
            host_user=user, status=Listing.Status.LIVE,
        ).update(status=Listing.Status.PENDING, published_at=None)
    else:
        raise AuthServiceError("Action must be 'approve' or 'reject'.", "INVALID_ACTION", 400)

    profile.id_reviewed_at = timezone.now()
    profile.id_reviewed_by = reviewer
    profile.save(update_fields=[
        "id_verification_status", "id_rejection_reason",
        "id_reviewed_at", "id_reviewed_by", "updated_at",
    ])


    reviewed_iso = profile.id_reviewed_at.isoformat()
    if action == "approve":
        dispatch(
            event_type=EventType.ID_VERIFICATION_APPROVED,
            recipients=[user],
            context={},
            idempotency_event_id=f"id_approved:{user.id}:{reviewed_iso}",
            channels=[NotificationChannel.IN_APP],
        )
    else:
        dispatch(
            event_type=EventType.ID_VERIFICATION_REJECTED,
            recipients=[user],
            context={"reason": reason or ""},
            idempotency_event_id=f"id_rejected:{user.id}:{reviewed_iso}",
            channels=[NotificationChannel.IN_APP],
        )

    return {
        "user_id": str(user.id),
        "phone": user.phone_number,
        "name": profile.display_name,
        "status": profile.id_verification_status,
        "reviewed_by": reviewer,
        "listings_promoted": promoted_count,
    }


def get_pending_verifications() -> list:
    """Returns list of users with pending ID verification."""

    pending = UserProfile.objects.filter(
        id_verification_status=UserProfile.IDVerificationStatus.PENDING,
    ).select_related("user").order_by("id_submitted_at")

    return [
        {
            "user_id": str(p.user_id),
            "phone": p.user.phone_number,
            "name": p.display_name,
            "city": p.city,
            "aadhaar_photo_url": get_photo_url(p.aadhaar_photo_url) if p.aadhaar_photo_url else None,
            "selfie_photo_url": get_photo_url(p.selfie_photo_url) if p.selfie_photo_url else None,
            "submitted_at": p.id_submitted_at.isoformat() if p.id_submitted_at else None,
        }
        for p in pending
    ]


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

    days_in_month = (today - month_start).days + 1
    booked_nights = sum(
        max((min(b.check_out_date, today) - max(b.check_in_date, month_start)).days, 0)
        for b in month_bookings
    )
    occupancy_pct = round((booked_nights / days_in_month) * 100) if days_in_month > 0 else 0

    review_agg = Review.objects.filter(
        reviewee_user=user,
        review_type=Review.ReviewType.GUEST_TO_HOST,
    ).aggregate(avg=Avg("overall_rating"), count=Count("id"))

    avg_rating = round(review_agg["avg"], 1) if review_agg["avg"] else None

    total_requests = Booking.objects.filter(
        host_user=user, booking_mode=Booking.BookingMode.REQUEST
    ).count()
    responded = Booking.objects.filter(
        host_user=user, booking_mode=Booking.BookingMode.REQUEST, host_responded_at__isnull=False
    ).count()
    response_rate = round((responded / total_requests) * 100) if total_requests > 0 else 100

    has_listings = Listing.objects.filter(
        host_user=user,
        status=Listing.Status.LIVE,
    ).exists()

    return {
        "earnings": earnings,
        "bookings": booking_count,
        "occupancy_pct": occupancy_pct if has_listings else None,
        "occupancy_nights_booked": booked_nights if has_listings else None,
        "occupancy_nights_total": days_in_month if has_listings else None,
        "avg_rating": avg_rating,
        "review_count": review_agg["count"],
        "response_rate_pct": response_rate if has_listings else None,
    }


def _get_today_activity(user: User, today) -> dict:
    check_ins = [
        {
            "booking_id": str(b.id),
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
            "booking_id": str(b.id),
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


# ─── Payout Account services ─────────────────────────────────

def get_payout_accounts(user: User) -> list[dict]:
    """Returns all payout accounts for a user."""
    accounts = PayoutAccount.objects.filter(user=user)
    return [_payout_to_dict(a) for a in accounts]


def add_bank_account(user: User, data: dict) -> dict:
    """Adds a bank account for payouts."""
    logger.info("add_bank_account user_id=%s", getattr(user, "id", None))
    has_accounts = PayoutAccount.objects.filter(user=user).exists()

    account = PayoutAccount.objects.create(
        user=user,
        account_type=PayoutAccount.AccountType.BANK,
        account_holder_name=data["account_holder_name"],
        account_number=data["account_number"],
        ifsc_code=data["ifsc_code"].upper(),
        bank_name=data["bank_name"],
        is_primary=not has_accounts,
    )
    return _payout_to_dict(account)


def add_upi_account(user: User, data: dict) -> dict:
    """Adds a UPI ID for payouts."""
    logger.info("add_upi_account user_id=%s", getattr(user, "id", None))
    has_accounts = PayoutAccount.objects.filter(user=user).exists()

    account = PayoutAccount.objects.create(
        user=user,
        account_type=PayoutAccount.AccountType.UPI,
        upi_id=data["upi_id"].lower(),
        is_primary=not has_accounts,
    )
    return _payout_to_dict(account)


def delete_payout_account(user: User, account_id: str) -> None:
    """Deletes a payout account."""
    logger.info("delete_payout_account user_id=%s account_id=%s", getattr(user, "id", None), account_id)
    try:
        account = PayoutAccount.objects.get(id=account_id, user=user)
    except PayoutAccount.DoesNotExist:
        raise AuthServiceError("Account not found.", "NOT_FOUND", 404)

    was_primary = account.is_primary
    account.delete()

    if was_primary:
        next_account = PayoutAccount.objects.filter(user=user).first()
        if next_account:
            next_account.is_primary = True
            next_account.save(update_fields=["is_primary"])


def set_primary_payout_account(user: User, account_id: str) -> dict:
    """Sets a payout account as primary."""
    logger.info("set_primary_payout_account user_id=%s account_id=%s", getattr(user, "id", None), account_id)
    try:
        account = PayoutAccount.objects.get(id=account_id, user=user)
    except PayoutAccount.DoesNotExist:
        raise AuthServiceError("Account not found.", "NOT_FOUND", 404)

    PayoutAccount.objects.filter(user=user).update(is_primary=False)
    account.is_primary = True
    account.save(update_fields=["is_primary"])
    return _payout_to_dict(account)


def _payout_to_dict(account) -> dict:
    """Convert PayoutAccount to response dict."""
    masked = ""
    if account.account_number and len(account.account_number) >= 4:
        masked = "****" + account.account_number[-4:]

    return {
        "id": str(account.id),
        "account_type": account.account_type,
        "is_primary": account.is_primary,
        "account_holder_name": account.account_holder_name,
        "account_number_masked": masked,
        "ifsc_code": account.ifsc_code,
        "bank_name": account.bank_name,
        "upi_id": account.upi_id,
    }


def upload_profile_photo(user: User, image_file) -> dict:
    """Upload user profile photo to storage. Returns URLs."""
    logger.info("upload_profile_photo user_id=%s", getattr(user, "id", None))
    try:
        profile = user.profile
        if profile.profile_photo_url:
            old_key = profile.profile_photo_url.split("/media/")[-1] if "/media/" in profile.profile_photo_url else None
            if not old_key and "s3" in profile.profile_photo_url:
                old_key = "/".join(profile.profile_photo_url.split("/")[4:])
            if old_key:
                delete_image(old_key)
    except UserProfile.DoesNotExist:
        raise AuthServiceError("Profile not found. Complete your profile first.", "PROFILE_NOT_FOUND", 404)

    try:
        result = upload_image(
            file_obj=image_file,
            folder=f"profiles/{user.id}",
            max_width=800,
        )
    except StorageError as e:
        raise AuthServiceError(e.message, "UPLOAD_FAILED", 400)

    profile.profile_photo_url = result["url"]
    profile.save(update_fields=["profile_photo_url", "updated_at"])

    return {
        "profile_photo_url": get_photo_url(result["url"]),
        "thumbnail_url": get_photo_url(result["thumbnail_url"]),
    }


def get_public_profile(viewed_user: User, viewer_user: User) -> dict:
    """
    Public-facing profile for one user, as seen by another user.
    Contact info gated on active booking relationship.
    """
    profile = getattr(viewed_user, "profile", None)

    contact_visible = _has_active_booking_relationship(viewer_user, viewed_user)

    review_qs = Review.objects.filter(
        reviewee_user=viewed_user,
        is_hidden=False,
    )
    review_agg = review_qs.aggregate(
        avg=Avg("overall_rating"),
        count=Count("id"),
    )

    stays_as_guest_count = Booking.objects.filter(
        guest_user=viewed_user,
        status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
    ).count()

    stays_as_host_count = Booking.objects.filter(
        host_user=viewed_user,
        status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
    ).count()

    recent_reviews = [
        {
            "rating": r.overall_rating,
            "body": (r.body or "")[:200],
            "submitted_at": r.submitted_at.isoformat(),
            "reviewer_name": get_display_name(r.reviewer_user),
            "reviewer_initials": get_initials(r.reviewer_user),
        }
        for r in review_qs.select_related("reviewer_user").order_by("-submitted_at")[:5]
    ]

    return {
        "user_id": str(viewed_user.id),
        "display_name": get_display_name(viewed_user),
        "initials": get_initials(viewed_user),
        "profile_photo_url": get_photo_url(profile.profile_photo_url) if profile and profile.profile_photo_url else None,
        "city": profile.city if profile else None,
        "member_since": (
            viewed_user.created_at.strftime("%B %Y")
            if viewed_user.created_at else None
        ),
        "verifications": {
            "phone_verified": viewed_user.phone_verified_at is not None,
            "email_verified": viewed_user.email_verified_at is not None,
            "id_verified": False,
        },
        "stats": {
            "stays_as_guest": stays_as_guest_count,
            "stays_as_host": stays_as_host_count,
            "review_count": review_agg["count"] or 0,
            "average_rating": (
                round(float(review_agg["avg"]), 1) if review_agg["avg"] else None
            ),
        },
        "recent_reviews": recent_reviews,
        "contact": (
            {
                "phone": (
                    f"{viewed_user.phone_country_code}{viewed_user.phone_number}"
                    if viewed_user.phone_number else None
                ),
                "email": viewed_user.email or None,
            }
            if contact_visible
            else None
        ),
    }


def _has_active_booking_relationship(viewer: User, viewed: User) -> bool:
    """
    True if viewer and viewed share at least one ACCEPTED/ACTIVE/COMPLETED
    booking. This gates visibility of contact info.
    """
    contact_safe_statuses = [
        Booking.Status.ACCEPTED,
        Booking.Status.ACTIVE,
        Booking.Status.COMPLETED,
    ]
    return Booking.objects.filter(
        models.Q(guest_user=viewer, host_user=viewed)
        | models.Q(guest_user=viewed, host_user=viewer),
        status__in=contact_safe_statuses,
    ).exists()

def delete_user_account(user: User) -> None:
    """
    Soft-delete a user account per Apple/Google requirements.
    - Sets status to DELETED
    - Anonymizes PII on the profile
    - Revokes all active sessions
    - Cancels any pending/accepted bookings
    """
    from apps.bookings.models import Booking

    logger.info("delete_user_account user_id=%s", user.id)

    # Cancel any active/pending bookings
    active_bookings = Booking.objects.filter(
        guest_user=user,
        status__in=["pending", "accepted"],
    )
    for b in active_bookings:
        b.status = Booking.Status.CANCELLED_BY_GUEST
        b.save(update_fields=["status"])

    # Anonymize profile
    try:
        profile = user.profile
        profile.first_name = "Deleted"
        profile.last_name = "User"
        profile.city = ""
        profile.date_of_birth = None
        profile.bio = ""
        profile.save()
    except Exception:
        pass

    # Revoke all sessions
    from apps.users.models import UserSession
    UserSession.objects.filter(user=user).update(
        revoked_at=timezone.now()
    )

    # Mark user as deleted
    user.status = User.Status.DELETED
    user.email = ""
    user.save(update_fields=["status", "email"])

    logger.info("delete_user_account completed for user_id=%s", user.id)