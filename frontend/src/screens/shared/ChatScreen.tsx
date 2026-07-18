import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import { getMessages, markConversationRead, sendMessage } from '../../services/chat';
import type { ChatMessage } from '../../types/chat';

const POLL_INTERVAL_MS = 3000;

type ChatRouteParams = { conversationId: string; title?: string; subtitle?: string; chatDisabled?: boolean; isInquiry?: boolean; listingId?: string };

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${day}/${month} ${time}`;
}

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, ChatRouteParams>, string>>();
  const { conversationId, title, subtitle, chatDisabled, isInquiry, listingId } = route.params;
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { userRole } = useAuth();

  // Tapping the property name opens that listing. This screen is shared by
  // both roles, and each stack registers the listing screen under its own name.
  const openListing = useCallback(() => {
    if (!listingId) return;
    if (userRole === 'host') {
      navigation.navigate('ListingDetail', { item: { listing_id: listingId } });
    } else {
      navigation.navigate('GuestListingDetail', { listingId });
    }
  }, [listingId, userRole, navigation]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const cursorRef = useRef<string | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const mergeIncoming = useCallback((incoming: ChatMessage[]) => {
    const fresh = incoming.filter((m) => !knownIds.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => knownIds.current.add(m.id));
    setMessages((prev) => [...prev, ...fresh]);
    cursorRef.current = fresh[fresh.length - 1].created_at;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getMessages(conversationId);
        if (!active) return;
        knownIds.current = new Set(res.results.map((m) => m.id));
        setMessages(res.results);
        if (res.results.length > 0) {
          cursorRef.current = res.results[res.results.length - 1].created_at;
        }
        await markConversationRead(conversationId);
      } catch {
        // leave empty on failure; returning to the screen retries
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [conversationId]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await getMessages(conversationId, cursorRef.current ?? undefined);
        if (res.results.length > 0) {
          const hadInbound = res.results.some((m) => !m.is_mine);
          mergeIncoming(res.results);
          if (hadInbound) {
            markConversationRead(conversationId).catch(() => {});
          }
        }
      } catch {
        // transient; next tick retries
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [conversationId, mergeIncoming]);

  const onSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      const msg = await sendMessage(conversationId, body);
      mergeIncoming([msg]);
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.bubbleRow, item.is_mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, item.is_mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, item.is_mine && styles.bubbleTextMine]}>{item.body}</Text>
        <Text style={[styles.bubbleTime, item.is_mine && styles.bubbleTimeMine]}>
          {fmtTime(item.created_at)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title ?? 'Chat'}</Text>
          {subtitle ? (
            listingId ? (
              <TouchableOpacity style={styles.headerSubBtn} activeOpacity={0.6} onPress={openListing}>
                <Text style={[styles.headerSub, styles.headerSubLink]} numberOfLines={1}>{subtitle}</Text>
                <Ionicons name="chevron-forward" size={12} color={COLORS.primary} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>
            )
          ) : null}
        </View>
        <View style={{ width: 36 }} />
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={COLORS.primary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listPad}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              isInquiry ? (
                <View style={styles.inquiryBanner}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.inquiryBannerTxt}>
                    Contact details like phone numbers are hidden until a booking is confirmed. Keep chats in the app to stay protected.
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptySub}>Say hello to start the conversation.</Text>
              </View>
            }
          />
        )}

        {chatDisabled ? (
          <View style={styles.chatDisabledBar}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMut} />
            <Text style={styles.chatDisabledTxt}>Messaging is disabled for this booking</Text>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message"
              placeholderTextColor={COLORS.textMut}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
              onPress={onSend}
              disabled={!draft.trim() || sending}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  // No flex here — headerCenter is a column, so flex:1 stretched this box and
  // clipped the descenders once the property link took the second line.
  // lineHeight leaves room for descenders with the custom font.
  headerTitle: { fontSize: 17, lineHeight: 22, ...FONTS.semibold, color: COLORS.text, textAlign: 'center' },

  listPad: { padding: SPACING.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.lg },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: COLORS.textMut, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptySub: { fontSize: 14, color: COLORS.textMut, textAlign: 'center' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 42,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: COLORS.text,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.textMut },
  chatDisabledBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  chatDisabledTxt: { fontSize: 13, color: COLORS.textMut, ...FONTS.medium },
  inquiryBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, backgroundColor: COLORS.primaryAlpha,
  },
  inquiryBannerTxt: { flex: 1, fontSize: 12.5, lineHeight: 18, color: COLORS.text, ...FONTS.medium },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSubBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  headerSubLink: { color: COLORS.primary },
  headerSub: { fontSize: 12, lineHeight: 16, color: COLORS.textSec, marginTop: 1, textAlign: 'center' },
});
