from django.urls import path

from apps.listings.views import (
    CreateListingView, HostListingsListView, ListingDetailView,
    ListingBlockedDatesView, ListingSnoozeView,
    GuestSearchView, GuestListingDetailView,
)

urlpatterns = [
    path("", CreateListingView.as_view(), name="create-listing"),
    path("host/", HostListingsListView.as_view(), name="host-listings-list"),
    path("search/", GuestSearchView.as_view(), name="guest-search"),
    path("guest/<uuid:listing_id>/", GuestListingDetailView.as_view(), name="guest-listing-detail"),
    path("<uuid:listing_id>/blocked-dates/", ListingBlockedDatesView.as_view(), name="listing-blocked-dates"),
    path("<uuid:listing_id>/snooze/", ListingSnoozeView.as_view(), name="listing-snooze"),
    path("<uuid:listing_id>/", ListingDetailView.as_view(), name="listing-detail"),
]
