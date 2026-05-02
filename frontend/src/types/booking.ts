export interface BookingQuote {
    listing_id: string;
    nights: number;
    host_nightly_price: number;
    guest_nightly_price: number;
    subtotal: number;
    gst_amount: number;
    platform_fee: number;
    security_deposit: number;
    total_guest_pays: number;
    total_host_receives: number;
    platform_revenue: number;
    currency: string;
    booking_mode: 'instant' | 'request';
  }
  
  export interface Booking {
    booking_id: string;
    booking_code: string;
    status: string;
    payment_status: string;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    total_guest_pays: number;
    total_host_receives: number;
    cancellation_policy: string | null;
  }
  
  export interface RazorpayOrder {
    razorpay_key_id: string;
    order_id: string;
    amount: number;
    currency: string;
    booking_code: string;
  }
  
  export interface PaymentVerifyResponse {
    booking_id: string;
    booking_code: string;
    status: string;
    payment_status: string;
  }
  
  export interface CancelBookingResponse {
    booking_id: string;
    status: string;
    payment_status: string;
    refund_amount: number;
  }