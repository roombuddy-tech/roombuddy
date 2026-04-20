import uuid
from django.db import models


class User(models.Model):

    class AuthProvider(models.TextChoices):
        EMAIL = "email", "Email"
        PHONE = "phone", "Phone"
        GOOGLE = "google", "Google"
        APPLE = "apple", "Apple"
        FACEBOOK = "facebook", "Facebook"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        BANNED = "banned", "Banned"
        DELETED = "deleted", "Deleted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=255, unique=True, null=True, blank=True)
    phone_country_code = models.CharField(max_length=5, default="+91")
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    password_hash = models.TextField(null=True, blank=True)
    auth_provider = models.CharField(
        max_length=20,
        choices=AuthProvider.choices,
        default=AuthProvider.EMAIL,
    )
    provider_user_id = models.CharField(max_length=255, null=True, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    two_fa_enabled = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        constraints = [
            models.UniqueConstraint(
                fields=["phone_country_code", "phone_number"],
                name="unique_phone",
                condition=models.Q(phone_number__isnull=False),
            ),
            models.CheckConstraint(
                condition=models.Q(email__isnull=False) | models.Q(phone_number__isnull=False),
                name="users_must_have_contact",
            ),
        ]

    def __str__(self):
        return self.email or self.phone_number or str(self.id)
