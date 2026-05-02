"""
Unified error response format.

Every API error is normalised to:
    { "error": "<human-readable message>", "code": "<MACHINE_CODE>" }

This handler bridges the gap between Django/DRF's heterogeneous exception
shapes and our uniform response contract:

1. Service-raised dicts like
       raise ValidationError({"error": "...", "code": "SELF_BOOKING"})
   are passed through verbatim — the frontend gets just the human message
   AND the machine code as separate fields.

2. DRF default `{detail: "..."}` responses get the message in `error` and a
   generic `code` of `ERROR`.

3. Multi-field validation errors get joined into a single string and tagged
   with code `VALIDATION_ERROR`.
"""
from rest_framework.views import exception_handler
from common.error_codes import ErrorCode


_GENERIC_CODE = "ERROR"
_VALIDATION_CODE = "VALIDATION_ERROR"


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    response.data = _normalise_payload(response.data)
    return response


def _normalise_payload(data) -> dict:
    """Convert any DRF error payload into the unified {error, code} shape."""
    # DRF wraps a dict argument to ValidationError as a list-of-strings per
    # field. Our services raise ValidationError with a literal dict like
    # {"error": "...", "code": "..."}, so DRF returns:
    #     {"error": ["Some text"], "code": ["SELF_BOOKING"]}
    # We detect this exact pattern and unwrap it.
    if isinstance(data, dict) and _is_service_shape(data):
        return _unwrap_service_shape(data)

    if isinstance(data, dict):
        # Standard DRF errors
        if "detail" in data:
            return {
                "error": str(data["detail"]),
                "code": str(data.get("code", _GENERIC_CODE)),
            }

        # Multi-field validation: combine into a single readable line
        messages = []
        for field, errors in data.items():
            if isinstance(errors, list):
                messages.append(f"{field}: {errors[0]}")
            else:
                messages.append(f"{field}: {errors}")
        return {
            "error": "; ".join(messages) if messages else "Validation error",
            "code": _VALIDATION_CODE,
        }

    if isinstance(data, list):
        return {
            "error": str(data[0]) if data else "Error",
            "code": _GENERIC_CODE,
        }

    return {"error": str(data), "code": _GENERIC_CODE}


def _is_service_shape(data: dict) -> bool:
    """
    Detect whether `data` looks like our `{error, code}` service payload
    after DRF wrapped each value in a list.
    """
    keys = set(data.keys())
    if keys != {"error", "code"} and keys != {"error"}:
        return False

    err = data.get("error")
    code = data.get("code")
    err_ok = isinstance(err, (list, str))
    code_ok = code is None or isinstance(code, (list, str))
    return err_ok and code_ok


def _unwrap_service_shape(data: dict) -> dict:
    """Pull the first string out of each field of a wrapped service payload."""

    def _first(value, default):
        if isinstance(value, list):
            return str(value[0]) if value else default
        if value is None:
            return default
        return str(value)

    return {
        "error": _first(data.get("error"), "Error"),
        "code": _first(data.get("code"), _GENERIC_CODE),
    }
