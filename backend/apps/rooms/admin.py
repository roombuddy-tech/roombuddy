from django.contrib import admin
from apps.rooms.models import Room


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("id", "property", "room_type", "bed_type", "bathroom_type")
    list_filter = ("room_type", "bed_type")
