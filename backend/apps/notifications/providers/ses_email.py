import logging
import os
import re

from .base import NotificationProvider, SendResult

logger = logging.getLogger(__name__)


class SESEmailProvider(NotificationProvider):
    """Sends email via Amazon SES. Boto3 picks credentials from IAM role on EC2,
    or ~/.aws/credentials locally."""

    def __init__(self):
        self.region = os.getenv("AWS_SES_REGION", "ap-south-1")
        self.from_email = os.getenv("SES_FROM_EMAIL", "noreply@roombuddy.co.in")

    def send(self, recipient, subject, body, metadata=None) -> SendResult:
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError:
            return SendResult(
                success=False, error="boto3 not installed", is_retriable=False,
            )

        try:
            client = boto3.client("ses", region_name=self.region)
            response = client.send_email(
                Source=self.from_email,
                Destination={"ToAddresses": [recipient]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": body, "Charset": "UTF-8"},
                        "Text": {"Data": _strip_html(body), "Charset": "UTF-8"},
                    },
                },
            )
            message_id = response.get("MessageId", "")
            logger.info(f"SES email sent to {recipient}, MessageId: {message_id}")
            return SendResult(success=True, provider_message_id=message_id)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg = e.response["Error"]["Message"]
            logger.error(f"SES error ({code}): {msg}")
            permanent = {
                "MessageRejected", "MailFromDomainNotVerified",
                "ConfigurationSetDoesNotExist", "AccountSendingPausedException",
            }
            return SendResult(
                success=False,
                error=f"{code}: {msg}",
                is_retriable=code not in permanent,
                is_permanent_failure=code in {"MessageRejected", "MailFromDomainNotVerified"},
            )
        except Exception as e:
            logger.exception(f"SES unexpected error: {e}")
            return SendResult(success=False, error=str(e), is_retriable=True)


def _strip_html(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()