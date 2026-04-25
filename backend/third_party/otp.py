import os
import random
import logging
import requests

logger = logging.getLogger(__name__)

OTP_PROVIDER = os.getenv("OTP_PROVIDER", "console")
MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY", "")
MSG91_TEMPLATE_ID = os.getenv("MSG91_TEMPLATE_ID", "")
MSG91_SENDER_ID = os.getenv("MSG91_SENDER_ID", "RMBDY")


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP of given length."""
    lower = 10 ** (length - 1)
    upper = (10 ** length) - 1
    return str(random.randint(lower, upper))


def send_otp(phone: str, otp_code: str) -> bool:
    """
    Send OTP via the configured provider.
    phone: Full phone with country code, e.g. "+919935361905"
    Returns True if sent successfully.
    """
    provider = OTP_PROVIDER.lower()

    if provider == "console":
        return _send_console(phone, otp_code)
    elif provider == "msg91":
        return _send_msg91(phone, otp_code)
    else:
        logger.error(f"Unknown OTP provider: {provider}")
        return False


def _send_console(phone: str, otp_code: str) -> bool:
    """Development: Print OTP to console."""
    logger.info(f"[CONSOLE OTP] Phone: {phone} | OTP: {otp_code}")
    print(f"\n{'='*50}")
    print(f"  OTP for {phone}: {otp_code}")
    print(f"{'='*50}\n")
    return True


def _send_msg91(phone: str, otp_code: str) -> bool:
    """Production: Send OTP via MSG91."""
    if not MSG91_AUTH_KEY or not MSG91_TEMPLATE_ID:
        logger.error("MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not configured")
        return False

    mobile = phone.lstrip("+")

    url = "https://control.msg91.com/api/v5/flow/"
    headers = {"authkey": MSG91_AUTH_KEY, "Content-Type": "application/json"}
    payload = {
        "template_id": MSG91_TEMPLATE_ID,
        "sender": MSG91_SENDER_ID,
        "short_url": "0",
        "mobiles": mobile,
        "var1": otp_code,
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("type") == "success":
                logger.info(f"OTP sent to {phone} via MSG91")
                return True
            else:
                logger.error(f"MSG91 error: {data}")
                return False
        else:
            logger.error(f"MSG91 HTTP {resp.status_code}: {resp.text}")
            return False
    except requests.RequestException as e:
        logger.error(f"MSG91 request failed: {e}")
        return False