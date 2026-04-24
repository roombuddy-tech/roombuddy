export const ENDPOINTS = {
  AUTH: {
    SEND_OTP: '/api/auth/otp/send/',
    VERIFY_OTP: '/api/auth/otp/verify/',
    COMPLETE_PROFILE: '/api/auth/profile/complete/',
    CHOOSE_ROLE: '/api/auth/role/choose/',
  },
  HOST: {
    PROPERTIES: '/api/host/properties/',
    DASHBOARD: '/api/host/dashboard/',
    BOOKINGS: '/api/host/bookings/',
    EARNINGS: '/api/host/earnings/',
    LISTINGS: '/api/host/listings/',
  },
  GUEST: {
    SEARCH: '/api/listings/search/',
    LISTING_DETAIL: '/api/listings/',
    BOOKINGS: '/api/bookings/',
  },
  CHAT: {
    CONVERSATIONS: '/api/conversations/',
  },
  AMENITIES: '/api/amenities/',
};