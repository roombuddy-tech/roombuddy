import os
import random
import logging
import requests

logger = logging.getLogger(__name__)

OTP_PROVIDER = os.environ.get("OTP_PROVIDER", "console")
MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_TEMPLATE_ID = os.environ.get("MSG91_TEMPLATE_ID", "")


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP. Used only in console mode."""
    lower = 10 ** (length - 1)
    upper = (10 ** length) - 1
    return str(random.randint(lower, upper))


def send_otp(phone: str, otp_code: str = None) -> bool:
    """
    Send OTP.
    - console: sends the locally generated otp_code (must be provided)
    - msg91:   triggers MSG91 to generate & send (otp_code ignored)
    """
    if OTP_PROVIDER == "msg91":
        return _send_msg91(phone)
    return _send_console(phone, otp_code)


def verify_otp(phone: str, otp_code: str) -> bool:
    """
    Verify OTP.
    - console: returns True (local hash check handled in services.py)
    - msg91:   calls MSG91 verify endpoint
    """
    if OTP_PROVIDER == "msg91":
        return _verify_msg91(phone, otp_code)
    return True


# ─── Console (dev) ────────────────────────────────────────────

def _send_console(phone: str, otp_code: str) -> bool:
    """Development: Print OTP to console."""
    logger.info(f"[CONSOLE OTP] Phone: {phone} | OTP: {otp_code}")
    print(f"\n{'='*50}")
    print(f"  OTP for {phone}: {otp_code}")
    print(f"{'='*50}\n")
    return True


# ─── MSG91 (production) ──────────────────────────────────────

def _send_msg91(phone: str) -> bool:
    """Production: MSG91 generates and sends the OTP."""
    if not MSG91_AUTH_KEY or not MSG91_TEMPLATE_ID:
        logger.error("MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not configured")
        return False

    mobile = phone.lstrip("+")
    url = "https://control.msg91.com/api/v5/otp"
    params = {
        "template_id": MSG91_TEMPLATE_ID,
        "mobile": mobile,
        "authkey": MSG91_AUTH_KEY,
        "otp_length": 6,
    }

    try:
        resp = requests.post(url, params=params, timeout=15)
        data = resp.json()
        if resp.status_code == 200 and data.get("type") == "success":
            logger.info(f"OTP sent to {phone} via MSG91")
            return True
        logger.error(f"MSG91 error ({resp.status_code}): {data}")
        return False
    except requests.RequestException as e:
        logger.error(f"MSG91 request failed: {e}")
        return False


def _verify_msg91(phone: str, otp_code: str) -> bool:
    """Production: Verify OTP via MSG91. authkey in header."""
    mobile = phone.lstrip("+")
    url = "https://control.msg91.com/api/v5/otp/verify"
    headers = {
        "authkey": MSG91_AUTH_KEY,
    }
    params = {
        "otp": otp_code,
        "mobile": mobile,
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        data = resp.json()
        if resp.status_code == 200 and data.get("type") == "success":
            logger.info(f"OTP verified for {phone} via MSG91")
            return True
        logger.warning(f"OTP verify failed for {phone}: {data}")
        return False
    except requests.RequestException as e:
        logger.error(f"MSG91 verify request failed: {e}")
        return False