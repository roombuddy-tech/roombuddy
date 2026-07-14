"""Send a test push notification to a user's registered devices.

Usage:
    python manage.py send_test_push --phone 9876543210
    python manage.py send_test_push --user-id <uuid>
    python manage.py send_test_push --phone 9876543210 --title "Hi" --body "It works!"

This calls the Expo push provider directly (no booking needed), so it's the
fastest way to confirm the backend → Expo → device path works end to end.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.notifications.models import DeviceToken
from apps.notifications.providers.registry import get_provider
from apps.users.models import User


class Command(BaseCommand):
    help = "Send a test push notification to a user's active devices."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", help="User UUID")
        parser.add_argument("--phone", help="User phone number (without country code)")
        parser.add_argument("--title", default="RoomBuddy test 🔔")
        parser.add_argument("--body", default="If you can see this, push notifications work!")

    def handle(self, *args, **opts):
        user = self._resolve_user(opts)
        tokens = list(
            DeviceToken.objects.filter(user=user, is_active=True).values_list("token", flat=True)
        )
        if not tokens:
            raise CommandError(
                f"User {user.id} has no active device tokens. "
                "Log in on a development build first so the app registers its token."
            )

        provider = get_provider("push")
        self.stdout.write(f"Sending to {len(tokens)} device(s) for user {user.id}...")
        for token in tokens:
            result = provider.send(
                recipient=token,
                subject=opts["title"],
                body=opts["body"],
                metadata={"push_data": {"event_type": "test"}},
            )
            if result.success:
                self.stdout.write(self.style.SUCCESS(
                    f"  ✓ sent to {token[:28]}…  (id={result.provider_message_id})"
                ))
            else:
                self.stdout.write(self.style.ERROR(
                    f"  ✗ {token[:28]}…  {result.error}"
                ))

    def _resolve_user(self, opts) -> User:
        if opts.get("user_id"):
            try:
                return User.objects.get(id=opts["user_id"])
            except User.DoesNotExist:
                raise CommandError(f"No user with id {opts['user_id']}")
        if opts.get("phone"):
            user = User.objects.filter(phone_number=opts["phone"]).first()
            if not user:
                raise CommandError(f"No user with phone {opts['phone']}")
            return user
        raise CommandError("Pass either --user-id or --phone")
