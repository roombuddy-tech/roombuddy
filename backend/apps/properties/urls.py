from django.urls import path
from apps.properties.views import PropertyPhotoUploadView

urlpatterns = [
    path("<uuid:property_id>/photos/", PropertyPhotoUploadView.as_view(), name="property-photo-upload"),
]
