def get_client_ip(request) -> str:
    """Extract client IP from request, handling proxies."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def get_display_name(user) -> str:
    """Get 'FirstName L.' format from a user. Falls back to 'Guest'."""
    try:
        profile = user.profile
        first = profile.first_name
        last = profile.last_name
        if last:
            return f"{first} {last[0]}."
        return first
    except Exception:
        return "Guest"


def get_initials(user) -> str:
    """Get 'FL' initials from a user. Falls back to 'G'."""
    try:
        profile = user.profile
        first = profile.first_name[0] if profile.first_name else ""
        last = profile.last_name[0] if profile.last_name else ""
        return f"{first}{last}".upper() or "G"
    except Exception:
        return "G"