import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, FONTS, SPACING } from '../../constants/theme';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications';
import type { AppNotification } from '../../types/notification';

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listNotifications();
      setItems(res.notifications);
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onPressItem = async (n: AppNotification) => {
    if (!n.read_at) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
        );
      } catch (e) {
        console.error('Failed to mark read', e);
      }
    }
    if (n.event_type === 'message.received' && n.payload?.conversation_id) {
      navigation.navigate('Chat', {
        conversationId: n.payload.conversation_id,
        title: n.payload.sender_name,
        subtitle: n.payload.listing_title || undefined,
      });
    }
  };

  const onMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const hasUnread = items.some((n) => !n.read_at);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const v = visualFor(item.event_type);
    return (
      <TouchableOpacity
        style={[styles.row, !item.read_at && styles.rowUnread]}
        onPress={() => onPressItem(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: v.bg }]}>
          <Ionicons name={v.icon} size={20} color={v.color} />
        </View>
        <View style={styles.rowMain}>
          <Text style={styles.subject} numberOfLines={1}>
            {item.subject || formatEventLabel(item.event_type)}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {stripHtml(item.body)}
          </Text>
          <Text style={styles.meta}>{formatRelative(item.sent_at ?? item.created_at)}</Text>
        </View>
        {!item.read_at && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={onMarkAllRead} hitSlop={8}>
            <Text style={styles.action}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? styles.emptyPad : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptySub}>Booking updates, messages and more will show up here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function visualFor(eventType: string): { icon: any; color: string; bg: string } {
  const green = '#10B981';
  const greenBg = 'rgba(16,185,129,0.12)';
  const coralBg = 'rgba(255,107,74,0.12)';
  if (eventType === 'message.received')
    return { icon: 'chatbubble-ellipses', color: COLORS.primary, bg: COLORS.primaryAlpha };
  if (eventType === 'id_verification.approved')
    return { icon: 'shield-checkmark', color: green, bg: greenBg };
  if (eventType === 'id_verification.rejected')
    return { icon: 'shield-outline', color: COLORS.accent, bg: coralBg };
  if (eventType.startsWith('booking.refund'))
    return { icon: 'cash-outline', color: green, bg: greenBg };
  if (
    eventType === 'booking.payment_failed' ||
    eventType === 'booking.host_rejected' ||
    eventType.includes('cancelled')
  )
    return { icon: 'close-circle', color: COLORS.accent, bg: coralBg };
  if (eventType === 'booking.payment_succeeded' || eventType === 'booking.host_accepted')
    return { icon: 'checkmark-circle', color: green, bg: greenBg };
  return { icon: 'notifications', color: COLORS.primary, bg: COLORS.primaryAlpha };
}

function formatEventLabel(eventType: string): string {
  return eventType.split('.').pop()?.replace(/_/g, ' ') || eventType;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatRelative(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, ...FONTS.bold, color: COLORS.text },
  action: { color: COLORS.primary, fontSize: 14, ...FONTS.semibold },
  headerSpacer: { width: 32 },

  row: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'flex-start',
  },
  rowUnread: { backgroundColor: COLORS.primaryAlpha },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowMain: { flex: 1 },
  subject: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, marginBottom: 3 },
  body: { fontSize: 14, color: COLORS.textSec, lineHeight: 19, marginBottom: 5 },
  meta: { fontSize: 12, color: COLORS.textMut },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginTop: 6,
    marginLeft: 8,
  },

  emptyPad: { flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.sm },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 21 },
});