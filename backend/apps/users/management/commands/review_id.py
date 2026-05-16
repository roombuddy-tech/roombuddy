"""
Review ID verifications from the command line.

Usage:
  python manage.py review_id --list
  python manage.py review_id --stats
  python manage.py review_id --approve --phone 9935361905
  python manage.py review_id --reject --phone 9935361905 --reason "Photo is blurry"
"""

from django.core.management.base import BaseCommand, CommandError
from apps.users.models import User, UserProfile
from apps.users.services import review_id_verification, get_pending_verifications, AuthServiceError


class Command(BaseCommand):
    help = "Review ID verifications (Aadhaar + selfie)"

    def add_arguments(self, parser):
        parser.add_argument("--list", action="store_true", help="List pending verifications")
        parser.add_argument("--stats", action="store_true", help="Show verification stats")
        parser.add_argument("--approve", action="store_true", help="Approve a user")
        parser.add_argument("--reject", action="store_true", help="Reject a user")
        parser.add_argument("--phone", type=str, help="User phone number")
        parser.add_argument("--reason", type=str, default="", help="Rejection reason")

    def handle(self, *args, **options):
        if options["stats"]:
            self._show_stats()
        elif options["list"]:
            self._list_pending()
        elif options["approve"]:
            self._review(options["phone"], "approve", options["reason"])
        elif options["reject"]:
            self._review(options["phone"], "reject", options["reason"])
        else:
            self.stdout.write("Use --list, --stats, --approve, or --reject")

    def _show_stats(self):
        self.stdout.write("\nID Verification Stats:")
        self.stdout.write("-" * 30)
        for val, label in UserProfile.IDVerificationStatus.choices:
            count = UserProfile.objects.filter(id_verification_status=val).count()
            self.stdout.write(f"  {label:<20} {count}")
        self.stdout.write("")

    def _list_pending(self):
        pending = get_pending_verifications()
        if not pending:
            self.stdout.write(self.style.SUCCESS("No pending verifications."))
            return

        self.stdout.write(f"\n{len(pending)} pending verification(s):\n")
        self.stdout.write(f"{'Phone':<15} {'Name':<25} {'City':<15} {'Submitted':<20}")
        self.stdout.write("-" * 75)
        for p in pending:
            self.stdout.write(f"{p['phone']:<15} {p['name']:<25} {p['city']:<15} {p['submitted_at'] or '-':<20}")
            if p['aadhaar_photo_url']:
                self.stdout.write(f"  Aadhaar: {p['aadhaar_photo_url']}")
            if p['selfie_photo_url']:
                self.stdout.write(f"  Selfie:  {p['selfie_photo_url']}")
            self.stdout.write("")

    def _review(self, phone, action, reason):
        if not phone:
            raise CommandError("--phone is required")
        if action == "reject" and not reason:
            raise CommandError("--reason is required when rejecting")

        try:
            user = User.objects.get(phone_number=phone)
        except User.DoesNotExist:
            raise CommandError(f"No user found with phone {phone}")

        try:
            result = review_id_verification(str(user.id), action, "CLI admin", reason)
            self.stdout.write(self.style.SUCCESS(f"\n✓ {result['name']} ({result['phone']}) — {result['status'].upper()}\n"))
        except AuthServiceError as e:
            raise CommandError(str(e))