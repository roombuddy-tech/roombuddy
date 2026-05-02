"""
Mint a JWT access token for testing.

Usage:
    python3 manage.py mint_token --phone 9999900002
"""
from django.core.management.base import BaseCommand

from apps.users.models import User
from common.jwt_utils import generate_access_token


class Command(BaseCommand):
    help = "Mint a test JWT access token for a user"

    def add_arguments(self, parser):
        parser.add_argument("--phone", required=True, help="Phone number e.g. 9999900002")

    def handle(self, *args, **opts):
        phone = opts["phone"]
        try:
            user = User.objects.get(phone_number=phone)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"No user with phone {phone}"))
            return

        token = generate_access_token(user.id)
        self.stdout.write(self.style.SUCCESS(f"\n✅ Token for {user.phone_country_code}{user.phone_number}:\n"))
        self.stdout.write(token)
        self.stdout.write("\n📋 Use in Swagger:")
        self.stdout.write(f"   Authorize → 'Bearer {token[:30]}...'\n")