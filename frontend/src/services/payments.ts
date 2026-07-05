import { ENDPOINTS } from '../constants/endpoints';
import type { PaymentVerifyResponse, RazorpayOrder } from '../types/booking';
import api from './api';

/** Create a Razorpay order for a confirmed booking. */
export async function createPaymentOrder(
  bookingId: string,
): Promise<RazorpayOrder> {
  const res = await api.post<RazorpayOrder>(
    ENDPOINTS.PAYMENT.CREATE_ORDER,
    { booking_id: bookingId },
  );
  return res.data;
}

/** Verify the signature returned by Razorpay checkout, marks booking as paid. */
export async function verifyPayment(payload: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<PaymentVerifyResponse> {
  const res = await api.post<PaymentVerifyResponse>(ENDPOINTS.PAYMENT.VERIFY, {
    razorpay_order_id: payload.orderId,
    razorpay_payment_id: payload.paymentId,
    razorpay_signature: payload.signature,
  });
  return res.data;
}

export interface UnlockOrderResponse {
  already_unlocked: boolean;
  razorpay_key_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
}

export interface UnlockVerifyResponse {
  listing_id: string;
  host_name: string;
  host_phone: string | null;
}

/** Create a Razorpay order to unlock a host's contact on a listing (₹29). */
export async function createUnlockOrder(
  listingId: string,
): Promise<UnlockOrderResponse> {
  const res = await api.post<UnlockOrderResponse>(
    ENDPOINTS.PAYMENT.UNLOCK_CREATE_ORDER,
    { listing_id: listingId },
  );
  return res.data;
}

/** Verify the unlock payment and get the host's phone number. */
export async function verifyUnlock(payload: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<UnlockVerifyResponse> {
  const res = await api.post<UnlockVerifyResponse>(
    ENDPOINTS.PAYMENT.UNLOCK_VERIFY,
    {
      razorpay_order_id: payload.orderId,
      razorpay_payment_id: payload.paymentId,
      razorpay_signature: payload.signature,
    },
  );
  return res.data;
}