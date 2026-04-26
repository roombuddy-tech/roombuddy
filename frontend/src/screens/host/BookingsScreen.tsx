import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';

interface BookingItem {
  booking_id: string;
  booking_code: string;
  guest_name: string;
  guest_initials: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  guest_purpose: string | null;
  status: string;
  total_guest_pays: number;
  total_host_receives: number;
}

const FILTERS = ['All', 'Active', 'Upcoming', 'Completed'];

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  active: { text: '#0D7377', bg: '#E6F5F0' },
  accepted: { text: '#0D7377', bg: '#E6F5F0' },
  pending: { text: '#B8860B', bg: '#FFF8E6' },
  upcoming: { text: '#B8860B', bg: '#FFF8E6' },
  completed: { text: '#5F7285', bg: '#F7F9FA' },
  cancelled_by_guest: { text: '#EF4444', bg: '#FFF0F0' },
  cancelled_by_host: { text: '#EF4444', bg: '#FFF0F0' },
  rejected: { text: '#EF4444', bg: '#FFF0F0' },
  expired: { text: '#94A3B8', bg: '#F7F9FA' },
  no_show: { text: '#EF4444', bg: '#FFF0F0' },
};

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
  const { switchRole } = useAuth();
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
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Text style={styles.brand}>Room<Text style={styles.brandAccent}>Buddy</Text></Text>
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.avatarBtn}>
            <Text style={styles.avatarText}>M</Text>
          </View>
        </View>
      </View>

      {/* Guest/Host toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity style={styles.toggleBtn} onPress={() => switchRole('guest')}>
          <Ionicons name="search-outline" size={16} color={COLORS.textSec} />
          <Text style={styles.toggleText}>Find a room</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, styles.toggleActiveHost]}>
          <Text style={styles.toggleEmoji}>🏠</Text>
          <Text style={styles.toggleActiveTextHost}>Host a room</Text>
        </TouchableOpacity>
      </View>

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
          bookings.map((b) => {
            const statusStyle = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
            return (
              <TouchableOpacity key={b.booking_id} style={styles.bookingCard} activeOpacity={0.7}>
                {/* Avatar */}
                <View style={styles.guestAvatar}>
                  <Text style={styles.guestInitials}>{b.guest_initials}</Text>
                </View>

                {/* Details */}
                <View style={styles.bookingDetails}>
                  <Text style={styles.guestName}>{b.guest_name}</Text>
                  <Text style={styles.bookingMeta}>
                    {formatDateRange(b.check_in_date, b.check_out_date)}
                    {b.guest_purpose ? ` · ${b.guest_purpose}` : ''}
                  </Text>
                  <Text style={styles.bookingPrice}>₹{b.total_host_receives.toLocaleString('en-IN')}</Text>
                </View>

                {/* Status badge */}
                <Text style={[styles.statusBadge, { color: statusStyle.text }]}>
                  {formatStatus(b.status)}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  scrollContent: { paddingBottom: SPACING.xl },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, marginTop: SPACING.sm },
  topLeft: { flexDirection: 'row', alignItems: 'baseline' },
  brand: { fontSize: 22, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, ...FONTS.bold },

  toggleRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.lg },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.sm },
  toggleActiveHost: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  toggleText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  toggleEmoji: { fontSize: 14 },
  toggleActiveTextHost: { fontSize: 14, color: COLORS.accent, ...FONTS.semibold },

  sectionTitle: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },

  filterRow: { marginBottom: SPACING.lg, maxHeight: 44 },
  filterContent: { gap: 8 },
  filterPill: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  filterPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  filterText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  filterTextActive: { color: COLORS.primary, ...FONTS.semibold },

  loadingArea: { paddingVertical: 60, alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xs },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center' },

  bookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.sm },
  guestAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  guestInitials: { fontSize: 16, ...FONTS.bold, color: COLORS.primary },
  bookingDetails: { flex: 1 },
  guestName: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  bookingMeta: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  bookingPrice: { fontSize: 14, ...FONTS.bold, color: COLORS.text, marginTop: 2 },
  statusBadge: { fontSize: 13, ...FONTS.semibold },
});
