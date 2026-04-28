import os
import logging

from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "console")
AWS_SES_REGION = os.getenv("AWS_SES_REGION", "ap-south-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
SES_FROM_EMAIL = os.getenv("SES_FROM_EMAIL", "noreply@roombuddy.co.in")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")


def _get_verify_link(token: str, user_id: str) -> str:
    return f"{APP_BASE_URL}/api/users/profile/email/verify-link/?token={token}&user_id={user_id}"


def _render_email(token: str, user_id: str) -> tuple[str, str]:
    """Render both HTML and plain text email using Django templates."""
    context = {"verify_link": _get_verify_link(token, user_id)}
    html = render_to_string("emails/verify_email.html", context)
    text = render_to_string("emails/verify_email.txt", context)
    return html, text


def send_verification_email(to_email: str, token: str, user_id: str) -> bool:
    """Send email verification via configured provider."""
    provider = EMAIL_PROVIDER.lower()

    if provider == "console":
        return _send_console(to_email, token, user_id)
    elif provider == "ses":
        return _send_ses(to_email, token, user_id)
    else:
        logger.error(f"Unknown email provider: {provider}")
        return False


def _send_console(to_email: str, token: str, user_id: str) -> bool:
    """Development: Print verification link to console."""
    verify_link = _get_verify_link(token, user_id)
    logger.info(f"[CONSOLE EMAIL] To: {to_email}")
    print(f"\n{'='*60}")
    print(f"  Email Verification for {to_email}")
    print(f"  Click: {verify_link}")
    print(f"{'='*60}\n")
    return True


def _send_ses(to_email: str, token: str, user_id: str) -> bool:
    """Production: Send email via Amazon SES."""
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        logger.error("boto3 not installed. Run: pip install boto3")
        return False

    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        logger.error("AWS credentials not configured for SES")
        return False

    body_html, body_text = _render_email(token, user_id)

    try:
        client = boto3.client(
            "ses",
            region_name=AWS_SES_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        response = client.send_email(
            Source=SES_FROM_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": "Verify your email — RoomBuddy", "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                },
            },
        )

        logger.info(f"SES email sent to {to_email}, MessageId: {response.get('MessageId', '')}")
        return True

    except ClientError as e:
        logger.error(f"SES error ({e.response['Error']['Code']}): {e.response['Error']['Message']}")
        return False
    except Exception as e:
        logger.error(f"SES unexpected error: {e}")
        return False