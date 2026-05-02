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