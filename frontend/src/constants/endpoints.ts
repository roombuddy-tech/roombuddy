export const ENDPOINTS = {
  AUTH: {
    SEND_OTP: '/api/users/auth/otp/send/',
    VERIFY_OTP: '/api/users/auth/otp/verify/',
    COMPLETE_PROFILE: '/api/users/auth/profile/complete/',
    REFRESH_TOKEN: '/api/users/auth/token/refresh/',
  },
  USER: {
    PROFILE: '/api/users/profile/me/',
    UPDATE_PROFILE: '/api/users/profile/update/',
    SEND_EMAIL_VERIFICATION: '/api/users/profile/email/send-verification/',
    VERIFY_EMAIL: '/api/users/profile/email/verify/',
    VERIFICATION_STATUS: '/api/users/profile/verification-status/',
  },
  HOST: {
    DASHBOARD: '/api/users/host/dashboard/',
    BOOKINGS: '/api/bookings/host/',
    EARNINGS: '/api/bookings/host/earnings/',
    LISTINGS: '/api/listings/host/',
    PROPERTIES: '/api/properties/',
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