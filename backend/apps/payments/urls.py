from django.urls import path

from apps.payments.views import (
    CreateOrderView,
    RazorpayWebhookView,
    VerifyPaymentView,
)

urlpatterns = [
    path("create-order/", CreateOrderView.as_view(), name="payment-create-order"),
    path("verify/", VerifyPaymentView.as_view(), name="payment-verify"),
    path("webhook/", RazorpayWebhookView.as_view(), name="payment-webhook"),
]