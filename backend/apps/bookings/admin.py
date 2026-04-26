from django.contrib import admin
from apps.bookings.models import Booking, BookingStatusHistory


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("booking_code", "guest_user", "host_user", "status", "check_in_date", "check_out_date", "total_host_receives")
    list_filter = ("status",)
    search_fields = ("booking_code",)


@admin.register(BookingStatusHistory)
class BookingStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("booking", "from_status", "to_status", "changed_at")