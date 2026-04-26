from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    """
    Unified error format:
    { "error": "Human-readable message", "code": "MACHINE_CODE" }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_data = {"error": "", "code": "ERROR"}

        if isinstance(response.data, dict):
            if "detail" in response.data:
                error_data["error"] = str(response.data["detail"])
                error_data["code"] = response.data.get("code", "ERROR")
            else:
                messages = []
                for field, errors in response.data.items():
                    if isinstance(errors, list):
                        messages.append(f"{field}: {errors[0]}")
                    else:
                        messages.append(f"{field}: {errors}")
                error_data["error"] = "; ".join(messages) if messages else "Validation error"
                error_data["code"] = "VALIDATION_ERROR"
        elif isinstance(response.data, list):
            error_data["error"] = str(response.data[0])

        response.data = error_data

    return response