export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string };
  ProfileSetup: undefined;
};

export type GuestTabParamList = {
  Home: undefined;
  MyStays: undefined;
  Messages: undefined;
};

export type HostTabParamList = {
  Today: undefined;
  Listing: undefined;
  Bookings: undefined;
  Earnings: undefined;
};

export type HostStackParamList = {
  HostTabs: undefined;
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
  Notifications: undefined;
  NotificationPreferences: undefined;
};

export type GuestStackParamList = {
  GuestTabs: undefined;
  GuestListingDetail: { listingId: string };
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
  };
  RazorpayCheckout: {
    bookingId: string;
    bookingCode: string;
    order: any;
  };
  BookingSuccess: {
    bookingId: string;
    bookingCode: string;
  };
  Notifications: undefined;
  NotificationPreferences: undefined;
};
