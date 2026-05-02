export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string };
  ProfileSetup: undefined;
};

export type GuestStackParamList = {
  GuestTabs: undefined;
  BookTest: undefined;
  BookingConfirm: {
    listingId: string;
    listingTitle: string;
    checkIn: string;
    checkOut: string;
    numberOfGuests?: number;
  };
  RazorpayCheckout: {
    bookingId: string;
    bookingCode: string;
    order: {
      razorpay_key_id: string;
      order_id: string;
      amount: number;
      currency: string;
      booking_code: string;
    };
  };
  BookingSuccess: {
    bookingId: string;
    bookingCode: string;
  };
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
  ListingEditor: { listingId?: string } | undefined;
  BookingDetail: { bookingId: string };
};
