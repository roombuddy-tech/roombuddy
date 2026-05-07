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
};
