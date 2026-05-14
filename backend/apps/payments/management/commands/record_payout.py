"""
Record a manual payout to a host.

Usage:
  # Record payout for specific bookings
  python manage.py record_payout --phone 9450321394 --amount 4500 \
      --reference "UTR123456789" --bookings RB-ABC123,RB-DEF456 \
      --method manual_bank --notes "May 1st half payout"

  # Record payout for a date range (auto-picks unpaid completed bookings)
  python manage.py record_payout --phone 9450321394 --amount 4500 \
      --reference "UTR123456789" --period-start 2026-05-01 --period-end 2026-05-15

  # List unpaid bookings for a host
  python manage.py record_payout --phone 9450321394 --list-unpaid

  # List all payouts for a host
  python manage.py record_payout --phone 9450321394 --list-payouts
"""

from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Sum
from django.utils import timezone

from apps.bookings.models import Booking
from apps.payments.models import Payout
from apps.users.models import User, PayoutAccount


class Command(BaseCommand):
    help = "Record a manual payout to a host"

    def add_arguments(self, parser):
        parser.add_argument("--phone", required=True, help="Host phone number (without country code)")
        parser.add_argument("--amount", type=str, help="Payout amount in INR")
        parser.add_argument("--reference", type=str, help="UTR / transaction reference number")
        parser.add_argument("--bookings", type=str, help="Comma-separated booking codes (e.g. RB-ABC123,RB-DEF456)")
        parser.add_argument("--period-start", type=str, help="Period start date (YYYY-MM-DD)")
        parser.add_argument("--period-end", type=str, help="Period end date (YYYY-MM-DD)")
        parser.add_argument("--method", type=str, default="manual_bank",
                            choices=["manual_bank", "manual_upi"],
                            help="Payment method used")
        parser.add_argument("--notes", type=str, default="", help="Optional notes")
        parser.add_argument("--status", type=str, default="completed",
                            choices=["pending", "completed"],
                            help="Payout status (default: completed)")
        parser.add_argument("--list-unpaid", action="store_true", help="List unpaid bookings for this host")
        parser.add_argument("--list-payouts", action="store_true", help="List all payouts for this host")

    def handle(self, *args, **options):
        phone = options["phone"]

        try:
            user = User.objects.get(phone_number=phone)
        except User.DoesNotExist:
            raise CommandError(f"No user found with phone number {phone}")

        host_name = f"{user.profile.first_name} {user.profile.last_name}" if hasattr(user, "profile") else phone
        self.stdout.write(f"\nHost: {host_name} (phone: {phone})")

        # ── List unpaid bookings ──
        if options["list_unpaid"]:
            self._list_unpaid(user)
            return

        # ── List payouts ──
        if options["list_payouts"]:
            self._list_payouts(user)
            return

        # ── Record payout ──
        amount_str = options.get("amount")
        reference = options.get("reference")
        if not amount_str:
            raise CommandError("--amount is required to record a payout")
        if not reference:
            raise CommandError("--reference is required (UTR / transaction ID)")

        amount = Decimal(amount_str)
        method = options["method"]
        notes = options["notes"]
        status = options["status"]

        # Find bookings
        bookings = []
        if options.get("bookings"):
            codes = [c.strip() for c in options["bookings"].split(",") if c.strip()]
            bookings = list(Booking.objects.filter(
                host_user=user,
                booking_code__in=codes,
            ))
            missing = set(codes) - {b.booking_code for b in bookings}
            if missing:
                raise CommandError(f"Booking codes not found: {', '.join(missing)}")
        elif options.get("period_start") and options.get("period_end"):
            p_start = date.fromisoformat(options["period_start"])
            p_end = date.fromisoformat(options["period_end"])
            bookings = list(Booking.objects.filter(
                host_user=user,
                status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
                check_in_date__gte=p_start,
                check_in_date__lte=p_end,
            ).exclude(payouts__status=Payout.Status.COMPLETED))

        # Find payout account
        payout_account = PayoutAccount.objects.filter(
            user=user
        ).order_by("-is_primary", "-created_at").first()

        # Show summary and confirm
        self.stdout.write(f"\n{'='*50}")
        self.stdout.write(f"  Amount:    ₹{amount}")
        self.stdout.write(f"  Method:    {method}")
        self.stdout.write(f"  Reference: {reference}")
        self.stdout.write(f"  Status:    {status}")
        if payout_account:
            if payout_account.account_type == "bank":
                self.stdout.write(f"  Account:   {payout_account.bank_name} ****{payout_account.account_number[-4:]}")
            else:
                self.stdout.write(f"  Account:   UPI {payout_account.upi_id}")
        if bookings:
            self.stdout.write(f"  Bookings:  {len(bookings)}")
            total_host = sum(b.total_host_receives for b in bookings)
            for b in bookings:
                self.stdout.write(f"    - {b.booking_code}: ₹{b.total_host_receives}")
            self.stdout.write(f"  Total host receives: ₹{total_host}")
            if amount != total_host:
                self.stdout.write(self.style.WARNING(
                    f"  ⚠ Payout amount (₹{amount}) differs from total host receives (₹{total_host})"
                ))
        if notes:
            self.stdout.write(f"  Notes:     {notes}")
        self.stdout.write(f"{'='*50}\n")

        confirm = input("Confirm this payout? (yes/no): ").strip().lower()
        if confirm != "yes":
            self.stdout.write(self.style.WARNING("Cancelled."))
            return

        # Create payout
        payout = Payout.objects.create(
            host_user=user,
            payout_account=payout_account,
            amount=amount,
            currency="INR",
            status=status,
            method=method,
            transfer_reference=reference,
            period_start=date.fromisoformat(options["period_start"]) if options.get("period_start") else None,
            period_end=date.fromisoformat(options["period_end"]) if options.get("period_end") else None,
            notes=notes,
            completed_at=timezone.now() if status == "completed" else None,
        )

        if bookings:
            payout.bookings.set(bookings)

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Payout recorded: {payout.id}\n"
            f"  ₹{amount} → {host_name} ({method})\n"
            f"  Reference: {reference}"
        ))

    def _list_unpaid(self, user):
        """Show completed bookings that haven't been paid out yet."""
        unpaid = Booking.objects.filter(
            host_user=user,
            status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
        ).exclude(
            payouts__status=Payout.Status.COMPLETED,
        ).order_by("check_in_date")

        if not unpaid.exists():
            self.stdout.write(self.style.SUCCESS("No unpaid bookings."))
            return

        total = Decimal("0")
        self.stdout.write(f"\nUnpaid bookings:")
        self.stdout.write(f"{'Code':<15} {'Check-in':<12} {'Check-out':<12} {'Host Receives':>14}")
        self.stdout.write("-" * 55)
        for b in unpaid:
            self.stdout.write(
                f"{b.booking_code:<15} {b.check_in_date!s:<12} {b.check_out_date!s:<12} ₹{b.total_host_receives:>12,.2f}"
            )
            total += b.total_host_receives

        self.stdout.write("-" * 55)
        self.stdout.write(f"{'Total':<39} ₹{total:>12,.2f}")
        self.stdout.write(f"\n{unpaid.count()} unpaid bookings\n")

    def _list_payouts(self, user):
        """Show all payouts for this host."""
        payouts = Payout.objects.filter(host_user=user).order_by("-initiated_at")

        if not payouts.exists():
            self.stdout.write("No payouts recorded yet.")
            return

        self.stdout.write(f"\nPayout history:")
        self.stdout.write(f"{'Date':<12} {'Amount':>10} {'Status':<12} {'Method':<14} {'Reference':<20} {'Bookings':>8}")
        self.stdout.write("-" * 80)
        for p in payouts:
            self.stdout.write(
                f"{p.initiated_at.strftime('%Y-%m-%d'):<12} "
                f"₹{p.amount:>8,.2f} "
                f"{p.status:<12} "
                f"{p.method:<14} "
                f"{p.transfer_reference or '-':<20} "
                f"{p.bookings.count():>8}"
            )

        total = payouts.filter(status=Payout.Status.COMPLETED).aggregate(
            total=Sum("amount")
        )["total"] or 0
        self.stdout.write("-" * 80)
        self.stdout.write(f"Total paid out: ₹{total:,.2f}\n")