export interface BookingQuote {
    listing_id: string;
    nights: number;
    host_nightly_price: number;
    guest_nightly_price: number;
    subtotal: number;
    gst_amount: number;
    gst_pct: number;
    platform_fee: number;
    platform_fee_pct: number;
    host_platform_fee: number;
    security_deposit: number;
    pay_to_host_directly: number;
    total_guest_pays: number;
    total_host_receives: number;
    platform_revenue: number;
    currency: string;
    booking_mode: 'instant' | 'request';
    meals_available: boolean;
    meal_cost_per_day: number | null;
    meal_total: number | null;
    meal_option: boolean;
    meal_types: string | null;
    cancellation_policy: 'flexible' | 'moderate' | 'strict';
    // Monthly listings (rental_type === 'monthly')
    rental_type?: 'monthly' | 'nightly';
    monthly_rent?: number;
    maintenance_monthly?: number;
    recurring_monthly?: number;
    setup_cost_onetime?: number;
    setup_cost_refundable?: boolean;
    move_in_cost?: number;
    min_months?: number | null;
    // Duration-aware figures for the selected period (monthly)
    days_selected?: number;
    per_day_rate?: number;
    stay_rent?: number;
    stay_total?: number;
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