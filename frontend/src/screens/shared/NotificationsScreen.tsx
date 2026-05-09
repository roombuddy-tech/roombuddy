import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from '../../services/notifications';
import type { AppNotification } from '../../types/notification';

export default function NotificationsScreen() {
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

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onPressItem = async (n: AppNotification) => {
    if (n.read_at) return;
    try {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      );
    } catch (e) {
      console.error('Failed to mark read', e);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {items.some((n) => !n.read_at) && (
          <TouchableOpacity onPress={onMarkAllRead}>
            <Text style={styles.action}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, !item.read_at && styles.unread]}
            onPress={() => onPressItem(item)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.subject} numberOfLines={1}>
                {item.subject || formatEventLabel(item.event_type)}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {stripHtml(item.body)}
              </Text>
              <Text style={styles.meta}>
                {formatRelative(item.created_at)} · {item.channel}
              </Text>
            </View>
            {!item.read_at && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

function formatEventLabel(eventType: string): string {
  return eventType
    .split('.')
    .pop()
    ?.replace(/_/g, ' ') || eventType;
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
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 22, fontWeight: '600' },
  action: { color: '#0a84ff', fontSize: 15 },
  row: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'flex-start',
  },
  unread: { backgroundColor: '#f5f9ff' },
  rowMain: { flex: 1 },
  subject: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  body: { fontSize: 14, color: '#666', marginBottom: 6 },
  meta: { fontSize: 12, color: '#999' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a84ff',
    marginTop: 8,
    marginLeft: 8,
  },
  empty: { fontSize: 15, color: '#999' },
});