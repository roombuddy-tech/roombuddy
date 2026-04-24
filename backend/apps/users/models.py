import uuid

from django.db import models


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

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
