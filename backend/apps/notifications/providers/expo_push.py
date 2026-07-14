import logging

import requests

from .base import NotificationProvider, SendResult

logger = logging.getLogger(__name__)


class ExpoPushProvider(NotificationProvider):
    """Sends push notifications through Expo's Push API.

    Expo relays to APNs (iOS) and FCM (Android) using the credentials
    configured on the EAS project, so no auth key is needed here — the
    recipient is an Expo push token (``ExponentPushToken[...]``).

    The dispatcher passes a single token as ``recipient``. Extra data for
    the app (e.g. which screen to open) can be supplied via
    ``metadata['push_data']``.
    """

    URL = "https://exp.host/--/api/v2/push/send"

    def send(self, recipient, subject, body, metadata=None) -> SendResult:
        metadata = metadata or {}
        token = (recipient or "").strip()

        if not token.startswith("ExponentPushToken") and not token.startswith("ExpoPushToken"):
            # Not a valid Expo token — nothing we can do, don't retry.
            return SendResult(
                success=False,
                error=f"Invalid Expo push token: {token[:32]}",
                is_retriable=False,
            )

        message = {
            "to": token,
            "title": subject or "RoomBuddy",
            "body": body or "",
            "sound": "default",
            "priority": "high",
            "channelId": "default",
        }
        push_data = metadata.get("push_data")
        if push_data:
            message["data"] = push_data

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
        }

        try:
            resp = requests.post(self.URL, json=message, headers=headers, timeout=15)
            data = resp.json() if resp.content else {}

            if resp.status_code != 200:
                is_retriable = resp.status_code >= 500 or resp.status_code == 429
                return SendResult(
                    success=False,
                    error=f"Expo {resp.status_code}: {resp.text[:200]}",
                    is_retriable=is_retriable,
                )

            # Expo returns {"data": {"status": "ok"|"error", ...}}
            ticket = data.get("data", {})
            status = ticket.get("status")

            if status == "ok":
                return SendResult(success=True, provider_message_id=ticket.get("id", ""))

            # status == "error"
            err = ticket.get("message", "unknown Expo error")
            expo_err_code = (ticket.get("details") or {}).get("error", "")
            # DeviceNotRegistered → token is dead, caller should deactivate it.
            permanent = expo_err_code in ("DeviceNotRegistered", "InvalidCredentials")
            return SendResult(
                success=False,
                error=f"Expo error: {err} ({expo_err_code})",
                is_retriable=not permanent,
                is_permanent_failure=permanent,
            )
        except requests.Timeout:
            return SendResult(success=False, error="Expo timeout", is_retriable=True)
        except requests.RequestException as e:
            logger.exception("Expo push request error: %s", e)
            return SendResult(success=False, error=str(e), is_retriable=True)
