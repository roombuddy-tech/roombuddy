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
  Profile: undefined;
};

export type HostTabParamList = {
  Today: undefined;
  Calendar: undefined;
  Listing: undefined;
  Bookings: undefined;
  Earnings: undefined;
  Settings: undefined;
};