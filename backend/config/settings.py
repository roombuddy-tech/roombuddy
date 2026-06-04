"""
Django settings for RoomBuddy backend.

Configuration is environment-driven via .env file.
- For LOCAL DEV: DJANGO_DEBUG=True, points to local Postgres + Redis
- For LOCAL DEV against AWS: set DATABASE_URL/REDIS_URL to AWS endpoints (still DEBUG=True)
- For PROD on EC2: DJANGO_DEBUG=False, all values from /etc/roombuddy/env
"""

import os
import ssl
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from backend/ directory
load_dotenv(BASE_DIR / ".env")

# ── Core ─────────────────────────────────────────────────────
DEBUG = os.environ.get("DJANGO_DEBUG", "False") == "True"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-only-not-for-production-xxxxxxxxxxxxxxxxxxxx"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY env var is required in production")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]

# ── Apps ─────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
    "apps.users",
    "apps.properties",
    "apps.rooms",
    "apps.amenities",
    "apps.listings",
    "apps.bookings",
    "apps.payments",
    "apps.reviews",
    "apps.health",
    "apps.notifications",
    "apps.conversations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ── Database ─────────────────────────────────────────────────
# Use DATABASE_URL env var. Falls back to local Postgres for dev.
# Examples:
#   Local:  postgres://roombuddy:roombuddy@localhost:5432/roombuddy
#   AWS:    postgres://user:pass@xxx.rds.amazonaws.com:5432/roombuddy
DATABASES = {
    "default": dj_database_url.config(
        default="postgres://roombuddy:roombuddy@localhost:5432/roombuddy",
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=not DEBUG,  # SSL required in prod, optional in dev
    )
}

# ── Redis (cache + distributed locks + webhook idempotency) ──
# rediss:// = TLS (ElastiCache); redis:// = plain (local dev)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_redis_options = {}
if REDIS_URL.startswith("rediss://"):
    _redis_options = {"ssl_cert_reqs": ssl.CERT_NONE}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "CONNECTION_POOL_KWARGS": _redis_options,
        },
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ── Auth / i18n ──────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ── Static / Media ───────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media: S3 in prod, local in dev (controlled by USE_S3 env)
USE_S3 = os.environ.get("USE_S3", "False") == "True"

if USE_S3:
    AWS_STORAGE_BUCKET_NAME = os.environ["AWS_STORAGE_BUCKET_NAME"]
    AWS_S3_REGION_NAME = os.environ.get("AWS_REGION", "ap-south-1")
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_CUSTOM_DOMAIN = (
        f"{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com"
    )
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"
else:
    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"

# Base URL used to build absolute URLs for local media files served in dev
SITE_URL = os.environ.get("SITE_URL", "http://192.168.1.40:8000")

# ── Email ────────────────────────────────────────────────────
# Console for dev, SMTP (SES) for prod
if DEBUG:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ.get("EMAIL_HOST", "email-smtp.ap-south-1.amazonaws.com")
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ["EMAIL_HOST_USER"]
    EMAIL_HOST_PASSWORD = os.environ["EMAIL_HOST_PASSWORD"]
    EMAIL_USE_TLS = True
    EMAIL_TIMEOUT = 10

DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL", "RoomBuddy <no-reply@roombuddy.co.in>"
)

# ── Defaults ─────────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── DRF ──────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "common.authentication.JWTAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "common.exceptions.custom_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "RoomBuddy API",
    "DESCRIPTION": (
        "RoomBuddy - Affordable short-term stays in shared homes.\n\n"
        "API for the RoomBuddy platform enabling peer-to-peer "
        "short-term room sharing in Indian cities."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "CONTACT": {"name": "RoomBuddy Team", "email": "support@roombuddy.co.in"},
    "TAGS": [
        {"name": "Health", "description": "Service health check endpoints"},
    ],
    "SCHEMA_PATH_PREFIX": "/api/",
}

# ── CORS ─────────────────────────────────────────────────────
# In dev, allow all (Expo on phone hits Django on Mac with random IPs).
# In prod, restrict to known origins.
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:8081",
    ).split(",")
    if o.strip()
]

# ── JWT ──────────────────────────────────────────────────────
ACCESS_TOKEN_LIFETIME_MINUTES = int(os.environ.get("ACCESS_TOKEN_LIFETIME_MINUTES", "10080"))
REFRESH_TOKEN_LIFETIME_DAYS = int(os.environ.get("REFRESH_TOKEN_LIFETIME_DAYS", "30"))

# ── Logging ──────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

# ── Platform fees ────────────────────────────────────────────
from decimal import Decimal as _Decimal

GST_PCT = _Decimal(os.environ.get("GST_PCT", "12.00"))
GUEST_PLATFORM_FEE_PCT = _Decimal(os.environ.get("GUEST_PLATFORM_FEE_PCT", "5.00"))
HOST_PLATFORM_FEE_PCT = _Decimal(os.environ.get("HOST_PLATFORM_FEE_PCT", "5.00"))

# ── Payments / Razorpay ──────────────────────────────────────
# "console" = local dev fake gateway (no Razorpay account needed)
# "razorpay" = real Razorpay (test or live mode based on key prefix)
PAYMENT_PROVIDER = os.environ.get("PAYMENT_PROVIDER", "console")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

# ── Booking & payment timing ─────────────────────────────────
PAYMENT_WINDOW_MINUTES = int(os.environ.get("PAYMENT_WINDOW_MINUTES", "15"))
HOST_RESPONSE_DEADLINE_HOURS = int(os.environ.get("HOST_RESPONSE_DEADLINE_HOURS", "24"))
BOOKING_LOCK_TTL_SECONDS = int(os.environ.get("BOOKING_LOCK_TTL_SECONDS", "120"))
WEBHOOK_IDEMPOTENCY_TTL_SECONDS = int(
    os.environ.get("WEBHOOK_IDEMPOTENCY_TTL_SECONDS", str(7 * 24 * 3600))
)

# ── OTP / SMS ────────────────────────────────────────────────
OTP_PROVIDER = os.environ.get("OTP_PROVIDER", "console")
MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_TEMPLATE_ID = os.environ.get("MSG91_TEMPLATE_ID", "")
MSG91_SENDER_ID = os.environ.get("MSG91_SENDER_ID", "RMBDY")

# ── App config ───────────────────────────────────────────────
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:8000")

# ── Security headers (production only) ───────────────────────
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"

# ── Sentry (error tracking, prod only) ───────────────────────
SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_DSN and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment=os.environ.get("ENVIRONMENT", "production"),
    )