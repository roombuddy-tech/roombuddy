import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    getNotificationPreferences,
    updateNotificationPreferences,
} from '../../services/notifications';
import type { NotificationPreference } from '../../types/notification';

export default function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getNotificationPreferences();
        setPrefs(data.preferences);
      } catch (e) {
        console.error('Failed to load preferences', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, { label: string; items: NotificationPreference[] }> = {};
    for (const p of prefs) {
      if (!map[p.event_type]) {
        map[p.event_type] = { label: p.event_label, items: [] };
      }
      map[p.event_type].items.push(p);
    }
    return map;
  }, [prefs]);

  const toggle = (eventType: string, channel: string) => {
    setPrefs((prev) =>
      prev.map((p) =>
        p.event_type === eventType && p.channel === channel
          ? { ...p, enabled: !p.enabled }
          : p,
      ),
    );
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateNotificationPreferences(
        prefs.map(({ event_type, channel, enabled }) => ({
          event_type,
          channel,
          enabled,
        })),
      );
      setDirty(false);
    } catch (e) {
      console.error('Failed to save preferences', e);
    } finally {
      setSaving(false);
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
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Notification preferences</Text>
        <Text style={styles.subtitle}>
          Choose how you want to be notified for each event.
        </Text>

        {Object.entries(grouped).map(([eventType, group]) => (
          <View key={eventType} style={styles.eventGroup}>
            <Text style={styles.eventLabel}>{group.label}</Text>
            {group.items.map((item) => (
              <View key={item.channel} style={styles.row}>
                <Text style={styles.channelLabel}>{item.channel_label}</Text>
                <Switch
                  value={item.enabled}
                  onValueChange={() => toggle(item.event_type, item.channel)}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {dirty && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={styles.saveBtn}
            disabled={saving}
            onPress={save}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Save changes'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  eventGroup: { marginBottom: 24 },
  eventLabel: { fontSize: 15, fontWeight: '500', marginBottom: 8, color: '#333' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 6,
  },
  channelLabel: { fontSize: 14 },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  saveBtn: {
    backgroundColor: '#0a84ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});