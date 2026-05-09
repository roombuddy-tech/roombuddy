from django.urls import path

from .views import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationPreferencesView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path("read-all/", NotificationMarkAllReadView.as_view(), name="notifications-read-all"),
    path("preferences/", NotificationPreferencesView.as_view(), name="notifications-preferences"),
    path("<uuid:notification_id>/read/", NotificationMarkReadView.as_view(), name="notifications-mark-read"),
]