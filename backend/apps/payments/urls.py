from django.urls import path

from apps.payments.views import (
    CreateOrderView,
    HostPayoutsView,
    RazorpayWebhookView,
    VerifyPaymentView,
)

urlpatterns = [
    path("create-order/", CreateOrderView.as_view(), name="payment-create-order"),
    path("verify/", VerifyPaymentView.as_view(), name="payment-verify"),
    path("webhook/", RazorpayWebhookView.as_view(), name="payment-webhook"),
    path("host/payouts/", HostPayoutsView.as_view(), name="host-payouts"),
]