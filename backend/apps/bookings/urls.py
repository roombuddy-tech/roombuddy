from django.urls import path

from apps.bookings.views import (
    BookingQuoteView,
    CancelBookingView,
    CreateBookingView,
    HostBookingsListView,
    HostEarningsView,
)

urlpatterns = [
    # Guest-facing endpoints
    path("quote/", BookingQuoteView.as_view(), name="booking-quote"),
    path("create/", CreateBookingView.as_view(), name="booking-create"),
    path("<uuid:booking_id>/cancel/", CancelBookingView.as_view(), name="booking-cancel"),

    # Host-facing endpoints
    path("host/", HostBookingsListView.as_view(), name="host-bookings-list"),
    path("host/earnings/", HostEarningsView.as_view(), name="host-earnings"),
]