from django.contrib import admin
from apps.properties.models import Property, PropertyFlatmate, PropertyPhoto


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ("title", "host_user", "apartment_type", "city_name", "status")
    list_filter = ("status", "city_name")
    search_fields = ("title", "apartment_name")


@admin.register(PropertyFlatmate)
class PropertyFlatmateAdmin(admin.ModelAdmin):
    list_display = ("name", "property", "gender", "occupation")


@admin.register(PropertyPhoto)
class PropertyPhotoAdmin(admin.ModelAdmin):
    list_display = ("id", "property", "area", "is_cover")
