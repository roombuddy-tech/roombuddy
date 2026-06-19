from django.urls import path

from apps.bookings.views import (
    BookingDetailView,
    BookingQuoteView,
    CancelBookingView,
    CreateBookingView,
    GuestBookingsListView,
    HostBookingsListView,
    HostEarningsView,
    HostRespondBookingView,
)

urlpatterns = [
    # Guest-facing endpoints
    path("guest/", GuestBookingsListView.as_view(), name="guest-bookings-list"),
    path("quote/", BookingQuoteView.as_view(), name="booking-quote"),
    path("create/", CreateBookingView.as_view(), name="booking-create"),
    path("<uuid:booking_id>/", BookingDetailView.as_view(), name="booking-detail"),
    path("<uuid:booking_id>/cancel/", CancelBookingView.as_view(), name="booking-cancel"),

    # Host-facing endpoints
    path("host/", HostBookingsListView.as_view(), name="host-bookings-list"),
    path("host/earnings/", HostEarningsView.as_view(), name="host-earnings"),
    path("<uuid:booking_id>/respond/", HostRespondBookingView.as_view(), name="booking-respond"),
]