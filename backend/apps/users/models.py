import uuid
import hashlib

from django.db import models
from django.utils import timezone


class User(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active"
        SUSPENDED = "suspended"
        BANNED = "banned"
        DELETED = "deleted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_country_code = models.CharField(max_length=5, default="+91")
    phone_number = models.CharField(max_length=15)
    email = models.EmailField(max_length=255, unique=True, null=True, blank=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    is_profile_complete = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        constraints = [
            models.UniqueConstraint(
                fields=["phone_country_code", "phone_number"],
                name="uq_users_phone",
            ),
        ]
        indexes = [
            models.Index(fields=["phone_country_code", "phone_number"], name="idx_users_phone"),
        ]

    def __str__(self):
        return f"{self.phone_country_code}{self.phone_number}"


class OTPCode(models.Model):
    """
    Stores hashed OTP codes for phone verification.
    Plain OTP is never stored — only the SHA-256 hash.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_codes")
    phone = models.CharField(max_length=20, help_text="Full phone with country code, e.g. +919935361905")
    otp_hash = models.CharField(max_length=64, help_text="SHA-256 hash of the OTP code")
    expires_at = models.DateTimeField()
    attempt_count = models.SmallIntegerField(default=0)
    max_attempts = models.SmallIntegerField(default=3)
    is_consumed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "otp_codes"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["phone", "-created_at"], name="idx_otp_phone_created"),
        ]

    @staticmethod
    def hash_otp(otp_code: str) -> str:
        return hashlib.sha256(otp_code.encode()).hexdigest()

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_max_attempts(self) -> bool:
        return self.attempt_count >= self.max_attempts

    @property
    def is_valid(self) -> bool:
        return not self.is_consumed and not self.is_expired and not self.is_max_attempts

    def verify(self, otp_code: str) -> bool:
        """Verify OTP. Increments attempt count. Marks consumed on success."""
        self.attempt_count += 1
        self.save(update_fields=["attempt_count"])

        if not self.is_expired and not self.is_consumed and self.attempt_count <= self.max_attempts:
            if self.otp_hash == self.hash_otp(otp_code):
                self.is_consumed = True
                self.save(update_fields=["is_consumed"])
                return True
        return False

    def __str__(self):
        return f"OTP for {self.phone} (consumed={self.is_consumed})"


class UserSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    refresh_token_hash = models.TextField()
    device_name = models.CharField(max_length=255, null=True, blank=True)
    device_os = models.CharField(max_length=50, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    last_active_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_sessions"
        indexes = [
            models.Index(
                fields=["user"],
                condition=models.Q(revoked_at__isnull=True),
                name="idx_sessions_active",
            ),
        ]

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > timezone.now()

    def revoke(self):
        self.revoked_at = timezone.now()
        self.save(update_fields=["revoked_at"])

    def __str__(self):
        return f"Session {self.id} – {self.user}"


class UserProfile(models.Model):
    class Gender(models.TextChoices):
        MALE = "male"
        FEMALE = "female"
        NON_BINARY = "non_binary"
        PREFER_NOT_TO_SAY = "prefer_not_to_say"

    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="profile")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=255, null=True, blank=True)
    gender = models.CharField(max_length=20, choices=Gender.choices)
    profile_photo_url = models.URLField(max_length=2048, null=True, blank=True)
    city = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profiles"

    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return self.display_name