import logging

from .base import NotificationProvider, SendResult

logger = logging.getLogger(__name__)


class ConsoleEmailProvider(NotificationProvider):
    def send(self, recipient, subject, body, metadata=None) -> SendResult:
        line = "=" * 60
        print(f"\n{line}\n[CONSOLE EMAIL] To: {recipient}\nSubject: {subject}\n\n{body}\n{line}\n")
        logger.info(f"[CONSOLE EMAIL] To: {recipient} | Subject: {subject}")
        return SendResult(success=True, provider_message_id="console-email")


class ConsoleSMSProvider(NotificationProvider):
    def send(self, recipient, subject, body, metadata=None) -> SendResult:
        line = "=" * 60
        print(f"\n{line}\n[CONSOLE SMS] To: {recipient}\n\n{body}\n{line}\n")
        logger.info(f"[CONSOLE SMS] To: {recipient} | Body: {body[:80]}")
        return SendResult(success=True, provider_message_id="console-sms")