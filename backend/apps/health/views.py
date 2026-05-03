import logging
from django.conf import settings
from django.db import connection
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    checks = {"django": "ok"}
    http_status = status.HTTP_200_OK

    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        checks["database"] = "ok"
    except Exception as e:
        logger.exception("Health check: DB failed")
        checks["database"] = f"error: {type(e).__name__}"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE

    try:
        cache.set("health_check", "ok", timeout=5)
        if cache.get("health_check") == "ok":
            checks["redis"] = "ok"
        else:
            checks["redis"] = "error: read mismatch"
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    except Exception as e:
        logger.exception("Health check: Redis failed")
        checks["redis"] = f"error: {type(e).__name__}"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE

    return Response(
        {
            "status": "healthy" if http_status == 200 else "unhealthy",
            "checks": checks,
            "environment": "production" if not settings.DEBUG else "development",
        },
        status=http_status,
    )