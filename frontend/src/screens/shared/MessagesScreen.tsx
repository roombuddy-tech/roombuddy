import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
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

import { FONTS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';
import { listConversations } from '../../services/chat';
import type { Conversation } from '../../types/chat';

function fmtRelative(iso: string | null): string {
  if (!iso) return '';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

export default function MessagesScreen() {
  const navigation = useNavigation<any>();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listConversations();
      setItems(res.results);
    } catch {
      setItems([]);
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

  const openThread = (c: Conversation) => {
    setItems((prev) =>
      prev.map((it) =>
        it.conversation_id === c.conversation_id ? { ...it, unread_count: 0 } : it,
      ),
    );
    navigation.navigate('Chat', {
      conversationId: c.conversation_id,
      title: c.counterpart_name,
      subtitle: c.listing_title ?? undefined,
      chatDisabled: c.chat_disabled,
    });
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openThread(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTxt}>{item.counterpart_initials}</Text>
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{item.counterpart_name}</Text>
          <Text style={styles.time}>{fmtRelative(item.last_message_at)}</Text>
        </View>
        {item.listing_title && (
          <View style={styles.listingRow}>
            <Ionicons name="home-outline" size={12} color={COLORS.textMut} />
            <Text style={styles.listing} numberOfLines={1}>{item.listing_title}</Text>
          </View>
        )}
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, item.unread_count > 0 && styles.previewUnread]}
            numberOfLines={1}
          >
            {item.last_message ?? 'No messages yet'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}><Text style={styles.headerTitle}>Messages</Text></View>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.headerTitle}>Messages</Text></View>
      <FlatList
        data={items}
        keyExtractor={(c) => c.conversation_id}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 ? styles.emptyPad : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-outline" size={36} color={COLORS.textMut} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>
              Once you message a host or guest, the conversation shows up here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 30, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarTxt: { fontSize: 16, ...FONTS.bold, color: COLORS.primary },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: COLORS.textMut },
  rowBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 3,
  },
  preview: { fontSize: 14, color: COLORS.textSec, flex: 1, marginRight: 8 },
  previewUnread: { color: COLORS.text, ...FONTS.medium },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 11, ...FONTS.bold },

  emptyPad: { flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.chip,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg,
  },
  emptyTitle: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.sm },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  listingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  listing: { fontSize: 12, color: COLORS.textMut, flex: 1 },
});
