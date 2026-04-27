from django.urls import path

from apps.listings.views import CreateListingView, HostListingsListView

urlpatterns = [
    path("", CreateListingView.as_view(), name="create-listing"),
    path("host/", HostListingsListView.as_view(), name="host-listings-list"),
]
