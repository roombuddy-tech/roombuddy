export type NotificationChannel = 'email' | 'sms' | 'push';

export type NotificationStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'dead'
  | 'skipped';

export interface AppNotification {
  id: string;
  event_type: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unread_count: number;
}

export interface NotificationPreference {
  event_type: string;
  event_label: string;
  channel: NotificationChannel;
  channel_label: string;
  enabled: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreference[];
}

export type PreferenceUpdate = Pick<
  NotificationPreference,
  'event_type' | 'channel' | 'enabled'
>;