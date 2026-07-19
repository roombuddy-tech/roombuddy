import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string; isSignup: boolean };
  ProfileSetup: undefined;
};

export type GuestTabParamList = {
  Home: { openSearch?: boolean } | undefined;
  MyStays: undefined;
  Messages: undefined;
};

export type HostTabParamList = {
  Today: undefined;
  Listing: { openVerification?: boolean } | undefined;
  Bookings: undefined;
  Earnings: undefined;
  Messages: undefined;
};

export type HostStackParamList = {
  HostTabs: NavigatorScreenParams<HostTabParamList> | undefined;
  ListingEditor: { listingId?: string; resumeDraft?: boolean };
  ListingDetail: {
    preview?: any;
    item?: {
      listing_id: string;
      title: string;
      area_name: string;
      host_price_per_night: number;
      guest_price_per_night: number;
      status: string;
      cover_photo_url: string | null;
    };
  };
  BookingDetail: { booking: any };
  GuestProfile: { userId: string };
  Notifications: undefined;
  NotificationPreferences: undefined;
  Chat: { conversationId: string; title?: string; subtitle?: string; chatDisabled?: boolean; isInquiry?: boolean; listingId?: string };
  Verification: undefined;
};

export type GuestStackParamList = {
  GuestTabs: undefined;
  GuestListingDetail: {
    listingId: string;
    checkIn?: string;
    checkOut?: string;
    unlockedContact?: { name: string; phone: string | null };
  };
  BookTest: undefined;
  BookingConfirm: {
    listingId: string;
    listingTitle: string;
    checkIn: string;
    checkOut: string;
    numberOfGuests?: number;
    mealOption?: boolean;
    mealsAvailable?: boolean;
    mealCostPerDay?: number | null;
    mealTypes?: string | null;
    mealDescription?: string | null;
    genderPreference?: string;
  };
  RazorpayCheckout: {
    bookingId: string;
    bookingCode: string;
    order: any;
    mode?: 'booking' | 'unlock';
    listingId?: string;
  };
  BookingSuccess: {
    bookingId: string;
    bookingCode: string;
  };
  Notifications: undefined;
  NotificationPreferences: undefined;
  Chat: { conversationId: string; title?: string; subtitle?: string; chatDisabled?: boolean; isInquiry?: boolean; listingId?: string };
  WriteReview: { bookingId: string; listingTitle: string; hostName: string };
};