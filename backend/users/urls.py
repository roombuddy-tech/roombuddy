from django.urls import path
from users.api.views import UserCreateView

urlpatterns = [
    path("", UserCreateView.as_view(), name="user-create"),
]
