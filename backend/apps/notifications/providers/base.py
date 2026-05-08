from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class SendResult:
    """Outcome of one provider send attempt."""
    success: bool
    provider_message_id: Optional[str] = None
    error: Optional[str] = None
    is_retriable: bool = True
    is_permanent_failure: bool = False


class NotificationProvider(ABC):
    """One concrete provider per channel + vendor (e.g. SES email, MSG91 SMS)."""

    @abstractmethod
    def send(
        self,
        recipient: str,
        subject: str,
        body: str,
        metadata: Optional[dict] = None,
    ) -> SendResult: ...