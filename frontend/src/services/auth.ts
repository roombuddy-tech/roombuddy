import api from './api';
import { ENDPOINTS } from '../constants/endpoints';
import type { OTPSendResponse, OTPVerifyResponse, ProfileCompleteResponse } from '../types/user';

export const authService = {
  async sendOTP(phoneNumber: string, countryCode: string = '+91'): Promise<OTPSendResponse> {
    const { data } = await api.post(ENDPOINTS.AUTH.SEND_OTP, {
      phone_number: phoneNumber,
      country_code: countryCode,
    });
    return data;
  },

  async verifyOTP(phoneNumber: string, otpCode: string, countryCode: string = '+91'): Promise<OTPVerifyResponse> {
    const { data } = await api.post(ENDPOINTS.AUTH.VERIFY_OTP, {
      phone_number: phoneNumber,
      country_code: countryCode,
      otp_code: otpCode,
    });
    return data;
  },

  async completeProfile(profile: {
    first_name: string;
    last_name: string;
    email?: string;
    gender: string;
    city: string;
  }): Promise<ProfileCompleteResponse> {
    const { data } = await api.post(ENDPOINTS.AUTH.COMPLETE_PROFILE, profile);
    return data;
  },

  async refreshToken(refreshToken: string): Promise<{ access: string }> {
    const { data } = await api.post(ENDPOINTS.AUTH.REFRESH_TOKEN, {
      refresh_token: refreshToken,
    });
    return data;
  },
};