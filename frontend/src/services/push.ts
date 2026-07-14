import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDeviceToken, unregisterDeviceToken } from './notifications';

const LAST_PUSH_TOKEN_KEY = 'last_push_token';

// Show a banner + play a sound even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    // @ts-ignore - older config shape
    Constants.easConfig?.projectId
  );
}

/**
 * Ask for permission, get this device's Expo push token, and register it with
 * the backend. Safe to call multiple times — it no-ops on simulators and when
 * permission is denied. Call after the user is authenticated.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      // Push tokens aren't available on simulators/emulators.
      return null;
    }

    // Android requires a notification channel for heads-up notifications.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B85C38',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      return null;
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return null;

    await registerDeviceToken(token, Platform.OS);
    await AsyncStorage.setItem(LAST_PUSH_TOKEN_KEY, token);
    return token;
  } catch (e) {
    // Never let push registration break the app flow.
    console.warn('Push registration failed:', e);
    return null;
  }
}

/** Deactivate this device's token on the backend (call on logout). */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(LAST_PUSH_TOKEN_KEY);
    if (token) {
      await unregisterDeviceToken(token);
      await AsyncStorage.removeItem(LAST_PUSH_TOKEN_KEY);
    }
  } catch (e) {
    console.warn('Push unregister failed:', e);
  }
}
