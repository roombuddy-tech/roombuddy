export interface User {
  id: string;
  phone_number: string;
  phone_country_code: string;
  email?: string;
  auth_provider: 'phone';
  is_profile_complete: boolean;
  phone_verified_at?: string;
}

export interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email?: string;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  profile_photo_url?: string;
  city: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface OTPSendResponse {
  message: string;
  phone: string;
  expires_in_seconds: number;
}

export interface OTPVerifyResponse {
  message: string;
  is_new_user: boolean;
  is_profile_complete: boolean;
  tokens: AuthTokens;
}

export interface ProfileCompleteResponse {
  user_id: string;
  display_name: string;
  is_profile_complete: boolean;
}
