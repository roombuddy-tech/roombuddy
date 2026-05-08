import logging
import os
from typing import Optional

import requests

from .base import NotificationProvider, SendResult

logger = logging.getLogger(__name__)


class MSG91SMSProvider(NotificationProvider):
    """
    Sends SMS via MSG91 Flow API (DLT template-based).

    Required env vars:
      MSG91_AUTH_KEY        - API auth key from MSG91 dashboard
      MSG91_SENDER_ID       - 6-letter DLT-approved sender (default RMBDY)
      MSG91_DEFAULT_FLOW_ID - fallback flow_id if a template doesn't specify one

    Each notification template must include `msg91_flow_id` and
    `msg91_variables` in its rendered context.
    """

    BASE_URL = "https://control.msg91.com/api/v5"

    def __init__(self):
        self.auth_key = os.getenv("MSG91_AUTH_KEY", "")
        self.sender_id = os.getenv("MSG91_SENDER_ID", "RMBDY")
        self.default_flow_id = os.getenv("MSG91_DEFAULT_FLOW_ID", "")

    def send(self, recipient, subject, body, metadata=None) -> SendResult:
        if not self.auth_key:
            return SendResult(
                success=False,
                error="MSG91_AUTH_KEY not configured",
                is_retriable=False,
            )

        metadata = metadata or {}
        flow_id = metadata.get("msg91_flow_id") or self.default_flow_id
        variables = metadata.get("msg91_variables", {})

        if not flow_id:
            return SendResult(
                success=False,
                error="No MSG91 flow_id provided",
                is_retriable=False,
            )

        phone = recipient.lstrip("+").replace(" ", "").replace("-", "")

        payload = {
            "template_id": flow_id,
            "sender": self.sender_id,
            "short_url": "0",
            "recipients": [{"mobiles": phone, **variables}],
        }

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json",
            "accept": "application/json",
        }

        try:
            response = requests.post(
                f"{self.BASE_URL}/flow/", json=payload, headers=headers, timeout=15,
            )
            data = response.json() if response.content else {}
            if response.status_code == 200 and data.get("type") == "success":
                request_id = data.get("request_id", "")
                logger.info(f"MSG91 SMS sent to {phone}, request_id: {request_id}")
                return SendResult(success=True, provider_message_id=request_id)

            error_msg = data.get("message") or response.text or "unknown"
            is_retriable = response.status_code >= 500
            logger.error(f"MSG91 error ({response.status_code}): {error_msg}")
            return SendResult(
                success=False,
                error=f"MSG91 {response.status_code}: {error_msg}",
                is_retriable=is_retriable,
            )
        except requests.Timeout:
            return SendResult(success=False, error="MSG91 timeout", is_retriable=True)
        except requests.RequestException as e:
            logger.exception(f"MSG91 request error: {e}")
            return SendResult(success=False, error=str(e), is_retriable=True)