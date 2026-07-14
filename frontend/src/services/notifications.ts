import { ENDPOINTS } from '../constants/endpoints';
import type {
    NotificationListResponse,
    NotificationPreferencesResponse,
    PreferenceUpdate,
} from '../types/notification';
import api from './api';

/** Fetch the current user's recent notifications. */
export async function listNotifications(): Promise<NotificationListResponse> {
  const res = await api.get<NotificationListResponse>(ENDPOINTS.NOTIFICATIONS.LIST);
  return res.data;
}

/** Register (or refresh) this device's Expo push token with the backend. */
export async function registerDeviceToken(token: string, platform: string): Promise<void> {
  await api.post(ENDPOINTS.NOTIFICATIONS.DEVICE_TOKEN, { token, platform });
}

/** Deactivate this device's push token (call on logout). */
export async function unregisterDeviceToken(token: string): Promise<void> {
  await api.delete(ENDPOINTS.NOTIFICATIONS.DEVICE_TOKEN, { data: { token } });
}

/** Mark a single notification as read. */
export async function markNotificationRead(id: string): Promise<{ marked_read: number }> {
  const res = await api.post<{ marked_read: number }>(
    ENDPOINTS.NOTIFICATIONS.MARK_READ(id),
  );
  return res.data;
}

/** Mark all unread notifications as read. */
export async function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  const res = await api.post<{ marked_read: number }>(
    ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ,
  );
  return res.data;
}

/** Get the user's per-event/per-channel notification preferences. */
export async function getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  const res = await api.get<NotificationPreferencesResponse>(
    ENDPOINTS.NOTIFICATIONS.PREFERENCES,
  );
  return res.data;
}

/** Bulk-update notification preferences. */
export async function updateNotificationPreferences(
  preferences: PreferenceUpdate[],
): Promise<{ updated: number }> {
  const res = await api.put<{ updated: number }>(
    ENDPOINTS.NOTIFICATIONS.PREFERENCES,
    { preferences },
  );
  return res.data;
}