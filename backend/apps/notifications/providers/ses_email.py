import email as email_lib
import email.encoders
import email.mime.base
import email.mime.multipart
import email.mime.text
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
        """Send a plain HTML email with no attachments."""
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

    def send_with_attachment(
        self,
        recipient: str,
        subject: str,
        body: str,
        attachment_bytes: bytes,
        attachment_filename: str,
        attachment_mime: str = "application/pdf",
    ) -> SendResult:
        """
        Send an HTML email with a single file attachment via SES send_raw_email.
        Used for booking invoices.
        """
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError:
            return SendResult(success=False, error="boto3 not installed", is_retriable=False)

        try:
            # Build MIME message
            msg = email.mime.multipart.MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = recipient

            # HTML + plain text body
            body_part = email.mime.multipart.MIMEMultipart("alternative")
            body_part.attach(email.mime.text.MIMEText(_strip_html(body), "plain", "utf-8"))
            body_part.attach(email.mime.text.MIMEText(body, "html", "utf-8"))
            msg.attach(body_part)

            # PDF attachment
            att = email.mime.base.MIMEBase(*attachment_mime.split("/"))
            att.set_payload(attachment_bytes)
            email.encoders.encode_base64(att)
            att.add_header(
                "Content-Disposition",
                "attachment",
                filename=attachment_filename,
            )
            msg.attach(att)

            client = boto3.client("ses", region_name=self.region)
            response = client.send_raw_email(
                Source=self.from_email,
                Destinations=[recipient],
                RawMessage={"Data": msg.as_bytes()},
            )
            message_id = response.get("MessageId", "")
            logger.info(
                f"SES email+attachment sent to {recipient}, "
                f"file={attachment_filename}, MessageId={message_id}"
            )
            return SendResult(success=True, provider_message_id=message_id)

        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg_str = e.response["Error"]["Message"]
            logger.error(f"SES attachment error ({code}): {msg_str}")
            permanent = {
                "MessageRejected", "MailFromDomainNotVerified",
                "ConfigurationSetDoesNotExist", "AccountSendingPausedException",
            }
            return SendResult(
                success=False,
                error=f"{code}: {msg_str}",
                is_retriable=code not in permanent,
                is_permanent_failure=code in {"MessageRejected", "MailFromDomainNotVerified"},
            )
        except Exception as e:
            logger.exception(f"SES send_with_attachment unexpected error: {e}")
            return SendResult(success=False, error=str(e), is_retriable=True)


def _strip_html(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
