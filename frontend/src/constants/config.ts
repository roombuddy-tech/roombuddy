// ── API endpoint toggle ─────────────────────────────────────
// Choose where Expo hits the backend.
//   "local"    = local Django on your Mac (http://192.168.1.2:8000)
//   "aws"      = AWS-hosted Django (https://api.roombuddy.co.in)
//   "prod"     = real production (used in release builds; same URL as aws for now)
//
// To switch: just change the value of API_TARGET below and reload Expo.

type ApiTarget = 'local' | 'aws' | 'prod';

// ⬇⬇⬇  CHANGE THIS LINE TO SWITCH BACKENDS  ⬇⬇⬇
const API_TARGET: ApiTarget = 'aws';

const API_URLS: Record<ApiTarget, string> = {
  local: 'http://192.168.7.4:8000',
  aws: 'https://api.roombuddy.co.in',
  prod: 'https://api.roombuddy.co.in',
};

// In production builds (__DEV__ === false), always use prod regardless of toggle.
// In dev (__DEV__ === true), respect API_TARGET.
const API_URL = __DEV__ ? API_URLS[API_TARGET] : API_URLS.prod;

export const CONFIG = {
  API_URL,
  API_TARGET: __DEV__ ? API_TARGET : 'prod',  
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: 300,
  // Early-stage flat fees (₹). Guest pays only the platform fee to book; rent,
  // deposit & meals are settled directly with the host. Unlock fee reveals the
  // host's phone number on a listing.
  BOOKING_PLATFORM_FEE: 49,
  CONTACT_UNLOCK_FEE: 29,
};
