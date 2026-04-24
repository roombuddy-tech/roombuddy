const DEV_API_URL = 'http://localhost:8000';
const PROD_API_URL = 'https://api.roombuddy.co.in';

export const CONFIG = {
  API_URL: __DEV__ ? DEV_API_URL : PROD_API_URL,
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: 300,
  OTP_MAX_ATTEMPTS: 3,
  USE_MOCK: true, // Set to false when real APIs are ready
};