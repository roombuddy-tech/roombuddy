export const ENDPOINTS = {
  AUTH: {
    SEND_OTP: '/api/users/auth/otp/send/',
    VERIFY_OTP: '/api/users/auth/otp/verify/',
    COMPLETE_PROFILE: '/api/users/auth/profile/complete/',
    REFRESH_TOKEN: '/api/users/auth/token/refresh/',
  },
  HOST: {
    DASHBOARD: '/api/users/host/dashboard/',
    PROPERTIES: '/api/properties/',
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