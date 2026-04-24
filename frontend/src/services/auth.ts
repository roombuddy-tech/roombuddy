import api from './api';
import { CONFIG } from '../constants/config';
import { ENDPOINTS } from '../constants/endpoints';
import type { OTPSendResponse, OTPVerifyResponse, ProfileCompleteResponse, RoleChooseResponse } from '../types/user';

// Mock data for development
const MOCK = {
  sendOTP: { message: 'OTP sent successfully', phone: '+919935361905', expires_in_seconds: 300 },
  verifyOTP: {
    message: 'OTP verified',
    is_new_user: true,
    is_profile_complete: false,
    has_chosen_role: false,
    tokens: { access: 'mock_access_token_123', refresh: 'mock_refresh_token_456' },
  },
  completeProfile: { user_id: 'mock-uuid-001', display_name: 'Mayank Kumar', is_profile_complete: true },
  chooseRole: { role: 'host' as const, granted_at: new Date().toISOString() },
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const authService = {
  async sendOTP(phoneNumber: string, countryCode: string = '+91'): Promise<OTPSendResponse> {
    if (CONFIG.USE_MOCK) {
      await delay(1000);
      console.log('[MOCK] OTP code is: 123456');
      return MOCK.sendOTP;
    }
    const { data } = await api.post(ENDPOINTS.AUTH.SEND_OTP, {
      phone_number: phoneNumber,
      country_code: countryCode,
    });
    return data;
  },

  async verifyOTP(phoneNumber: string, otpCode: string, countryCode: string = '+91'): Promise<OTPVerifyResponse> {
    if (CONFIG.USE_MOCK) {
      await delay(800);
      if (otpCode !== '123456') {
        throw { response: { data: { error: 'Incorrect OTP. Please try again.', code: 'INVALID_OTP' } } };
      }
      return MOCK.verifyOTP;
    }
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
    if (CONFIG.USE_MOCK) {
      await delay(600);
      return {
        ...MOCK.completeProfile,
        display_name: `${profile.first_name} ${profile.last_name}`,
      };
    }
    const { data } = await api.post(ENDPOINTS.AUTH.COMPLETE_PROFILE, profile);
    return data;
  },

  async chooseRole(role: 'guest' | 'host'): Promise<RoleChooseResponse> {
    if (CONFIG.USE_MOCK) {
      await delay(400);
      return { ...MOCK.chooseRole, role };
    }
    const { data } = await api.post(ENDPOINTS.AUTH.CHOOSE_ROLE, { role });
    return data;
  },
};