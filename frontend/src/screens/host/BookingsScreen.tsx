import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors, ThemeShadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import type { HostStackParamList, HostTabParamList } from '../../navigation/types';
import api from '../../services/api';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<HostTabParamList, 'Bookings'>,
  NativeStackNavigationProp<HostStackParamList>
>;

interface BookingItem {
  booking_id: string;
  booking_code: string;
  guest_name: string;
  guest_initials: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  guest_purpose: string | null;
  listing_title?: string;
  status: string;
  total_guest_pays: number;
  total_host_receives: number;
}

const AVATAR_PALETTE = [
  { bg: 'rgba(34,197,94,0.15)', text: '#16A34A' },
  { bg: 'rgba(59,130,246,0.15)', text: '#2563EB' },
  { bg: 'rgba(234,179,8,0.15)', text: '#B45309' },
  { bg: 'rgba(168,85,247,0.15)', text: '#7C3AED' },
  { bg: 'rgba(239,68,68,0.15)', text: '#DC2626' },
  { bg: 'rgba(20,184,166,0.15)', text: '#0F766E' },
];

const FILTERS = ['All', 'Active', 'Upcoming', 'Completed'];

const makeStatusColors = (COLORS: ThemeColors): Record<string, { text: string; bg: string }> => ({
  active: { text: COLORS.success, bg: COLORS.accentSoft },
  accepted: { text: COLORS.success, bg: COLORS.accentSoft },
  pending: { text: COLORS.primaryDark, bg: COLORS.raised },
  upcoming: { text: COLORS.primaryDark, bg: COLORS.raised },
  completed: { text: COLORS.textSec, bg: COLORS.chip },
  cancelled_by_guest: { text: COLORS.danger, bg: COLORS.raised },
  cancelled_by_host: { text: COLORS.danger, bg: COLORS.raised },
  rejected: { text: COLORS.danger, bg: COLORS.raised },
  expired: { text: COLORS.textMut, bg: COLORS.chip },
  no_show: { text: COLORS.danger, bg: COLORS.raised },
});

function formatDateRange(checkIn: string, checkOut: string): string {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = months[start.getMonth()];
  const endMonth = months[end.getMonth()];

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1);
}

export default function BookingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const STATUS_COLORS = useMemo(() => makeStatusColors(COLORS), [COLORS]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const fetchBookings = async (filter: string) => {
    try {
      const param = filter.toLowerCase();
      const res = await api.get(ENDPOINTS.HOST.BOOKINGS, {
        params: { status: param },
      });
      setBookings(res.data.results);
    } catch (err) {
      console.log('Bookings fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookings(activeFilter);
  }, [activeFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(activeFilter);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setLoading(true);
  };

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title */}
        <Text style={styles.sectionTitle}>Bookings</Text>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
              onPress={() => handleFilterChange(f)}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Booking cards */}
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySub}>When guests book your room, they'll appear here.</Text>
          </View>
        ) : (
          bookings.map((b, idx) => {
            const statusStyle = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
            const avatarColor = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
            return (
              <TouchableOpacity
                key={b.booking_id}
                style={styles.bookingCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BookingDetail', { booking: b })}
              >
                {/* Row 1: Avatar + Name + Status */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.guestAvatar, { backgroundColor: avatarColor.bg }]}>
                    <Text style={[styles.guestInitials, { color: avatarColor.text }]}>{b.guest_initials}</Text>
                  </View>
                  <View style={styles.bookingDetails}>
                    <Text style={styles.guestName}>{b.guest_name}</Text>
                    <Text style={styles.bookingMeta} numberOfLines={1}>
                      {b.listing_title ? `${b.listing_title} · ` : ''}{b.nights} night{b.nights === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={[styles.statusBadge, { color: statusStyle.text }]}>
                    {formatStatus(b.status)}
                  </Text>
                </View>

                {/* Row 2: Date range + Price */}
                <View style={styles.cardBottomRow}>
                  <Text style={styles.dateRange}>{formatDateRange(b.check_in_date, b.check_out_date)}</Text>
                  <Text style={styles.bookingPrice}>₹{b.total_host_receives.toLocaleString('en-IN')}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  scrollContent: { paddingBottom: SPACING.xl },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, marginTop: SPACING.sm },
  topLeft: { flexDirection: 'row', alignItems: 'baseline' },
  brand: { fontSize: 22, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.primary },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, ...FONTS.bold },

  sectionTitle: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },

  filterRow: { marginBottom: SPACING.lg, maxHeight: 44 },
  filterContent: { gap: 8 },
  filterPill: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  filterPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  filterText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  filterTextActive: { color: COLORS.onPrimary, ...FONTS.semibold },

  loadingArea: { paddingVertical: 60, alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xs },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center' },

  bookingCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.sm },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  guestAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  guestInitials: { fontSize: 15, ...FONTS.bold },
  bookingDetails: { flex: 1 },
  guestName: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  bookingMeta: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  dateRange: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },
  bookingPrice: { fontSize: 15, ...FONTS.bold, color: COLORS.text },
  statusBadge: { fontSize: 13, ...FONTS.semibold },
});
