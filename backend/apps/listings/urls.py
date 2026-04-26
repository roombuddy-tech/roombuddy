from django.urls import path

from apps.listings.views import HostListingsListView

urlpatterns = [
    path("host/", HostListingsListView.as_view(), name="host-listings-list"),
]
