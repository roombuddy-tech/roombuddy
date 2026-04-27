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