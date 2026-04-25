const DEV_API_URL = 'http://192.168.7.2:8000';
const PROD_API_URL = 'https://api.roombuddy.co.in';

export const CONFIG = {
  API_URL: __DEV__ ? DEV_API_URL : PROD_API_URL,
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: 300,
};