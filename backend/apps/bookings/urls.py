from django.urls import path

from apps.bookings.views import HostBookingsListView

urlpatterns = [
    path("host/", HostBookingsListView.as_view(), name="host-bookings-list"),
]
