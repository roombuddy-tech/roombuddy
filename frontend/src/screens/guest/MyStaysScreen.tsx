import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { startConversation } from '../../services/chat';

import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import type { GuestStackParamList } from '../../navigation/types';
import api from '../../services/api';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

interface GuestBooking {
  booking_id: string;
  booking_code: string;
  listing_id: string | null;
  listing_title: string | null;
  area_name: string | null;
  city: string | null;
  cover_photo_url: string | null;
  host_name: string;
  host_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  status: string;
  payment_status: string;
  total_guest_pays: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Pending confirmation', color: '#B45309', bg: '#FEF3C7', icon: 'time-outline' },
  accepted: { label: 'Confirmed', color: '#047857', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  active: { label: 'Active stay', color: COLORS.primary, bg: COLORS.primaryAlpha, icon: 'home-outline' },
  completed: { label: 'Completed', color: COLORS.textSec, bg: COLORS.surface, icon: 'checkmark-done-outline' },
  rejected: { label: 'Rejected by host', color: COLORS.danger, bg: '#FEE2E2', icon: 'close-circle-outline' },
  cancelled_by_guest: { label: 'Cancelled', color: COLORS.textMut, bg: COLORS.surface, icon: 'close-outline' },
  cancelled_by_host: { label: 'Cancelled by host', color: COLORS.danger, bg: '#FEE2E2', icon: 'close-outline' },
  expired: { label: 'Expired', color: COLORS.textMut, bg: COLORS.surface, icon: 'alert-circle-outline' },
  no_show: { label: 'No show', color: COLORS.textMut, bg: COLORS.surface, icon: 'alert-outline' },
};

function fmtDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function MyStaysScreen() {
  const navigation = useNavigation<Nav>();
  const [bookings, setBookings] = useState<GuestBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.GUEST.BOOKINGS);
      setBookings(res.data.results ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchBookings();
    }, [fetchBookings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const callHost = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const messageHost = async (b: GuestBooking) => {
    try {
      const convo = await startConversation(b.booking_id);
      navigation.navigate('Chat', {
        conversationId: convo.conversation_id,
        title: b.host_name,
        subtitle: convo.listing_title ?? undefined,
      });
    } catch {
      // network error — screen stays as-is; user can retry
    }
  };

  const renderBooking = ({ item }: { item: GuestBooking }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
    const canContact = item.status === 'accepted' || item.status === 'active';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          if (item.listing_id) {
            navigation.navigate('GuestListingDetail', { listingId: item.listing_id });
          }
        }}
      >
        <Image
          source={item.cover_photo_url ? { uri: item.cover_photo_url } : require('../../../assets/icon.png')}
          style={styles.cardImg}
          resizeMode="cover"
        />

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.listing_title ?? 'Untitled listing'}
          </Text>
          <Text style={styles.cardSub}>
            {[item.area_name, item.city].filter(Boolean).join(', ')}
          </Text>

          <View style={styles.datesRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSec} />
            <Text style={styles.datesText}>
              {fmtDateShort(item.check_in_date)} – {fmtDateShort(item.check_out_date)}
            </Text>
            <Text style={styles.nightsText}>{item.nights} night{item.nights !== 1 ? 's' : ''}</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.priceLabel}>Total paid</Text>
              <Text style={styles.priceValue}>
                {'₹'}{Math.round(item.total_guest_pays).toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.msgBtn}
                onPress={() => messageHost(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} />
                <Text style={styles.msgBtnTxt}>Message</Text>
              </TouchableOpacity>

              {canContact && item.host_phone && (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => callHost(item.host_phone!)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={16} color="#fff" />
                  <Text style={styles.contactBtnTxt}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.hostName}>Hosted by {item.host_name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Loading ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Stays</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────

  if (bookings.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Stays</Text>
        </View>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIllustration}>
            <View style={styles.emptyHouse}>
              <Ionicons name="home" size={40} color={COLORS.primary} />
            </View>
            <View style={styles.emptyCalendar}>
              <Ionicons name="calendar" size={24} color={COLORS.accent} />
            </View>
            <View style={styles.emptyHeart}>
              <Ionicons name="heart" size={20} color="#E879A0" />
            </View>
          </View>
          <Text style={styles.emptyTitle}>No stays yet</Text>
          <Text style={styles.emptySub}>
            Your bookings will appear here once you{'\n'}find the perfect room
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            activeOpacity={0.85}
            onPress={() => {
              navigation.getParent()?.navigate('GuestTabs', { screen: 'Home', params: { openSearch: true } });
            }}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.emptyBtnTxt}>Find a room</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main list ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Stays</Text>
      </View>
      <FlatList
        data={bookings}
        keyExtractor={(b) => b.booking_id}
        renderItem={renderBooking}
        contentContainerStyle={styles.listPad}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 24, ...FONTS.bold, color: COLORS.text },

  listPad: { padding: SPACING.lg, paddingBottom: SPACING.xxl },

  card: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.md, overflow: 'hidden', ...SHADOW.sm,
  },
  cardImg: { width: '100%', height: 160, backgroundColor: COLORS.surface },
  cardBody: { padding: SPACING.md },
  cardTitle: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  cardSub: { fontSize: 13, color: COLORS.textSec, marginBottom: SPACING.sm },

  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  datesText: { fontSize: 13, color: COLORS.text, ...FONTS.medium },
  nightsText: { fontSize: 12, color: COLORS.textMut, marginLeft: 4 },

  statusRow: { flexDirection: 'row', marginBottom: SPACING.md },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill,
  },
  statusText: { fontSize: 12, ...FONTS.semibold },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  priceLabel: { fontSize: 11, color: COLORS.textMut, ...FONTS.medium },
  priceValue: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginTop: 1 },

  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  contactBtnTxt: { color: '#fff', fontSize: 13, ...FONTS.semibold },

  hostName: { fontSize: 12, color: COLORS.textMut },

  emptyWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIllustration: {
    width: 140, height: 140,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyHouse: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center',
  },
  emptyCalendar: {
    position: 'absolute', top: 4, right: 8,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.accentAlpha, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.bg,
  },
  emptyHeart: {
    position: 'absolute', bottom: 12, left: 6,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FCE4EC', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.bg,
  },
  emptyTitle: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.sm },
  emptySub: {
    fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  emptyBtnTxt: { color: '#fff', fontSize: 16, ...FONTS.bold },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  msgBtnTxt: { color: COLORS.primary, fontSize: 13, ...FONTS.semibold },
});
