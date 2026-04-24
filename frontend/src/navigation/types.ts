export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string };
  ProfileSetup: undefined;
  RoleSelection: undefined;
};

export type GuestTabParamList = {
  Home: undefined;
  Search: undefined;
  MyStays: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type HostTabParamList = {
  Dashboard: undefined;
  Listings: undefined;
  Bookings: undefined;
  Messages: undefined;
  Settings: undefined;
};