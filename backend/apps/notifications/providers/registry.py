import os
from typing import Callable, Dict

from .base import NotificationProvider
from .console import ConsoleEmailProvider, ConsoleSMSProvider
from .msg91_sms import MSG91SMSProvider
from .ses_email import SESEmailProvider


def get_email_provider() -> NotificationProvider:
    name = os.getenv("EMAIL_PROVIDER", "console").lower()
    if name == "ses":
        return SESEmailProvider()
    return ConsoleEmailProvider()


def get_sms_provider() -> NotificationProvider:
    name = os.getenv("SMS_PROVIDER", "console").lower()
    if name == "msg91":
        return MSG91SMSProvider()
    return ConsoleSMSProvider()


_FACTORIES: Dict[str, Callable[[], NotificationProvider]] = {
    "email": get_email_provider,
    "sms": get_sms_provider,
}


def get_provider(channel: str) -> NotificationProvider:
    factory = _FACTORIES.get(channel)
    if factory is None:
        raise ValueError(f"No provider configured for channel: {channel}")
    return factory()