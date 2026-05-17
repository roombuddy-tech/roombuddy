import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra ?? {};

export const GOOGLE_PLACES_API_KEY = Platform.select({
  ios: extra.googlePlacesApiKeyIos,
  android: extra.googlePlacesApiKeyAndroid,
}) ?? '';

export const DEFAULT_REGION = {
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};
