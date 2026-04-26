from django.urls import path

from apps.bookings.views import HostBookingsListView, HostEarningsView

urlpatterns = [
    path("host/", HostBookingsListView.as_view(), name="host-bookings-list"),
    path("host/earnings/", HostEarningsView.as_view(), name="host-earnings"),

]
