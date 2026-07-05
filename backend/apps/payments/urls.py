from django.urls import path

from apps.payments.views import (
    CreateOrderView,
    CreateUnlockOrderView,
    HostPayoutsView,
    RazorpayWebhookView,
    VerifyPaymentView,
    VerifyUnlockView,
)

urlpatterns = [
    path("create-order/", CreateOrderView.as_view(), name="payment-create-order"),
    path("verify/", VerifyPaymentView.as_view(), name="payment-verify"),
    path("unlock/create-order/", CreateUnlockOrderView.as_view(), name="unlock-create-order"),
    path("unlock/verify/", VerifyUnlockView.as_view(), name="unlock-verify"),
    path("webhook/", RazorpayWebhookView.as_view(), name="payment-webhook"),
    path("host/payouts/", HostPayoutsView.as_view(), name="host-payouts"),
]