from django.contrib import admin
from apps.listings.models import Listing, ListingAmenity, ListingHouseRules


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("title", "host_user", "host_price_per_night", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("title",)


@admin.register(ListingAmenity)
class ListingAmenityAdmin(admin.ModelAdmin):
    list_display = ("listing", "amenity")


@admin.register(ListingHouseRules)
class ListingHouseRulesAdmin(admin.ModelAdmin):
    list_display = ("listing", "cancellation_policy")
