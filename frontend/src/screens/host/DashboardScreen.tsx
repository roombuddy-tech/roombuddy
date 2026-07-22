import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import NotificationBell from '../../components/NotificationBell';
import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors, ThemeShadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { HostStackParamList } from '../../navigation/types';
import ProfileMenu from '../../screens/shared/ProfileMenu';
import api from '../../services/api';

type Nav = NativeStackNavigationProp<HostStackParamList>;

interface DashboardData {
  greeting_name: string;
  this_month: {
    earnings: number;
    bookings: number;
    occupancy_pct: number;
    occupancy_nights_booked: number;
    occupancy_nights_total: number;
    avg_rating: number | null;
    review_count: number;
    response_rate_pct: number;
  };
  today: {
    check_ins: Array<{ booking_id: string; booking_code: string; guest_name: string; nights: number; check_in_time: string }>;
    check_outs: Array<{ booking_id: string; booking_code: string; guest_name: string }>;
    recent_reviews: Array<{ reviewer_name: string; rating: number; title: string | null; body: string; submitted_at: string }>;
  };
  pending_actions?: Array<{
    booking_id: string;
    booking_code: string;
    guest_name: string;
    listing_title: string;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    total_host_receives: number;
    hours_left: number | null;
  }>;
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { switchRole, user } = useAuth();
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const [showProfile, setShowProfile] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Same avatar logic as GuestTabs — uses AuthContext user data only
  const initial = (user?.first_name?.[0] || user?.display_name?.[0] || 'U').toUpperCase();

  const fetchDashboard = async () => {
    try {
      const res = await api.get(ENDPOINTS.HOST.DASHBOARD);
      setData(res.data);
    } catch (err) {
      console.log('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING,';
    if (hour < 17) return 'GOOD AFTERNOON,';
    return 'GOOD EVENING,';
  };

  const openBooking = (bookingId: string) => {
    navigation.navigate('BookingDetail', { booking: { booking_id: bookingId } });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const d = data;
  const name = d?.greeting_name || user?.first_name || 'Host';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Top bar: Brand + Switch + Bell + Avatar */}
        <View style={styles.topBar}>
          <Text style={styles.brand}>Room<Text style={styles.brandAccent}>Buddy</Text></Text>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.switchBtn} onPress={() => switchRole('guest')} activeOpacity={0.7}>
              <Ionicons name="repeat" size={16} color={COLORS.surface} />
              <Text style={styles.switchBtnTxt}>Guest</Text>
            </TouchableOpacity>
            <NotificationBell style={styles.bellBtn} />
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)}>
              {user?.profile_photo_url ? (
                <Image source={{ uri: user.profile_photo_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.name}>{name}</Text>

        {/* Priority: booking requests awaiting the host's response. Sits above
            everything so the host can't miss that a guest has paid and is
            waiting. Tapping a row opens the booking, where Accept/Decline live. */}
        {(d?.pending_actions?.length ?? 0) > 0 && (
          <View style={styles.actionBanner}>
            <View style={styles.actionBannerHead}>
              <View style={styles.actionBannerDot} />
              <Text style={styles.actionBannerTitle}>
                {d!.pending_actions!.length === 1
                  ? '1 booking needs your response'
                  : `${d!.pending_actions!.length} bookings need your response`}
              </Text>
            </View>
            {d!.pending_actions!.map((a) => (
              <TouchableOpacity
                key={a.booking_id}
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => openBooking(a.booking_id)}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.actionGuest} numberOfLines={1}>
                    {a.guest_name}
                    <Text style={styles.actionSep}> – </Text>
                    {a.nights} night{a.nights === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.actionMeta} numberOfLines={1}>
                    {a.listing_title || 'Your listing'}
                    {a.hours_left != null
                      ? a.hours_left > 0
                        ? ` · ${a.hours_left}h left`
                        : ' · respond now'
                      : ''}
                  </Text>
                </View>
                <View style={styles.actionCta}>
                  <Text style={styles.actionCtaTxt}>Review</Text>
                  <Ionicons name="chevron-forward" size={15} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats grid — 2x2 premium white cards */}
        <View style={styles.statsGrid}>
          {/* Card 1: THIS MONTH */}
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <View style={styles.statIcon}><Ionicons name="wallet-outline" size={15} color={COLORS.primary} /></View>
              <Text style={styles.statLabel}>This month</Text>
            </View>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>
              ₹{(d?.this_month.earnings || 0).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.statSub}>
              {(d?.this_month.bookings || 0) === 0 ? 'No bookings yet' : `${d?.this_month.bookings} booking${d?.this_month.bookings === 1 ? '' : 's'}`}
            </Text>
          </View>

          {/* Card 2: OCCUPANCY */}
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <View style={styles.statIcon}><Ionicons name="bed-outline" size={15} color={COLORS.primary} /></View>
              <Text style={styles.statLabel}>Occupancy</Text>
            </View>
            <Text style={styles.statValue}>
              {d?.this_month.occupancy_pct != null ? `${d.this_month.occupancy_pct}%` : '—'}
            </Text>
            <Text style={styles.statSub}>
              {d?.this_month?.occupancy_nights_total != null
                ? (d.this_month.occupancy_nights_booked > 0
                  ? `${d.this_month.occupancy_nights_booked}/${d.this_month.occupancy_nights_total} nights`
                  : 'No bookings yet')
                : 'No active listings'}
            </Text>
          </View>

          {/* Card 3: AVG RATING */}
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <View style={styles.statIcon}><Ionicons name="star" size={15} color={COLORS.star} /></View>
              <Text style={styles.statLabel}>Avg rating</Text>
            </View>
            <Text style={styles.statValue}>
              {d?.this_month.avg_rating != null ? d.this_month.avg_rating : '—'}
            </Text>
            <Text style={styles.statSub}>
              {(d?.this_month.review_count || 0) === 0 ? 'No reviews yet' : `${d?.this_month.review_count} review${d?.this_month.review_count === 1 ? '' : 's'}`}
            </Text>
          </View>

          {/* Card 4: RESPONSE */}
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <View style={styles.statIcon}><Ionicons name="flash-outline" size={15} color={COLORS.primary} /></View>
              <Text style={styles.statLabel}>Response</Text>
            </View>
            <Text style={styles.statValue}>
              {d?.this_month.response_rate_pct != null ? `${d.this_month.response_rate_pct}%` : '—'}
            </Text>
            <Text style={styles.statSub}>
              {d?.this_month.response_rate_pct != null ? 'This month' : 'No requests yet'}
            </Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} activeOpacity={0.8} onPress={() => navigation.navigate('ListingEditor', {})}>
            <View style={styles.quickIcon}><Ionicons name="add-circle-outline" size={22} color={COLORS.primary} /></View>
            <Text style={styles.quickLabel}>Add a listing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} activeOpacity={0.8} onPress={() => navigation.navigate('HostTabs', { screen: 'Bookings' } as any)}>
            <View style={styles.quickIcon}><Ionicons name="calendar-outline" size={22} color={COLORS.primary} /></View>
            <Text style={styles.quickLabel}>Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} activeOpacity={0.8} onPress={() => navigation.navigate('HostTabs', { screen: 'Earnings' } as any)}>
            <View style={styles.quickIcon}><Ionicons name="trending-up-outline" size={22} color={COLORS.primary} /></View>
            <Text style={styles.quickLabel}>Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Today section */}
        <Text style={styles.sectionTitle}>Today</Text>

        {d?.today.check_ins && d?.today.check_ins.length > 0 ? (
          d?.today.check_ins.map((ci, i) => {
            const guestInitial = (ci.guest_name?.[0] || '?').toUpperCase();
            return (
              <TouchableOpacity
                key={ci.booking_id || i}
                style={styles.activityCard}
                activeOpacity={0.7}
                onPress={() => openBooking(ci.booking_id)}
              >
                <View style={[styles.activityIcon, { backgroundColor: COLORS.primary }]}>
                  <Text style={styles.activityInitial}>{guestInitial}</Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{ci.guest_name} checks in</Text>
                  <Text style={styles.activitySub}>{ci.check_in_time} · {ci.nights} nights</Text>
                </View>
                <View style={styles.viewBtn}>
                  <Text style={styles.viewBtnText}>View</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.onPrimary} style={styles.chevron} />
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.activityCard}>
            <View style={[styles.activityIcon, { backgroundColor: COLORS.chip }]}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textMut} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>No check-ins today</Text>
              <Text style={styles.activitySub}>You're all clear!</Text>
            </View>
          </View>
        )}

        {d?.today.check_outs && d?.today.check_outs.length > 0 && (
          d?.today.check_outs.map((co, i) => {
            const guestInitial = (co.guest_name?.[0] || '?').toUpperCase();
            return (
              <TouchableOpacity
                key={`co-${co.booking_id || i}`}
                style={styles.activityCard}
                activeOpacity={0.7}
                onPress={() => openBooking(co.booking_id)}
              >
                <View style={[styles.activityIcon, { backgroundColor: COLORS.chip }]}>
                  <Text style={[styles.activityInitial, { color: COLORS.textSec }]}>{guestInitial}</Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{co.guest_name} checks out</Text>
                  <Text style={styles.activitySub}>Completed</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMut} />
              </TouchableOpacity>
            );
          })
        )}

        {d?.today.recent_reviews && d?.today.recent_reviews.length > 0 && (
          d?.today.recent_reviews.map((rv, i) => (
            <View key={`rv-${i}`} style={styles.activityCard}>
              <View style={[styles.activityIcon, { backgroundColor: COLORS.chip }]}>
                <Ionicons name="star" size={20} color={COLORS.star} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>New review from {rv.reviewer_name}</Text>
                <Text style={styles.activitySub}>{'★'.repeat(rv.rating)}{rv.title ? ` ${rv.title}` : ''}</Text>
                {rv.body ? <Text style={styles.activitySub} numberOfLines={2}>{rv.body}</Text> : null}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <ProfileMenu visible={showProfile} onClose={() => setShowProfile(false)} />
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, marginTop: SPACING.sm },
  brand: { fontSize: 24, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.primary },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarText: { color: COLORS.onPrimary, fontSize: 14, ...FONTS.semibold },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.text, borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  switchBtnTxt: { fontSize: 13, color: COLORS.surface, ...FONTS.semibold },
  bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.chip, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 11, color: COLORS.textSec, ...FONTS.semibold, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
  name: { fontSize: 32, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5, marginBottom: SPACING.lg },
  actionBanner: {
    backgroundColor: COLORS.accentAlpha,
    borderWidth: 1,
    borderColor: 'rgba(184,92,56,0.28)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: 10,
  },
  actionBannerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  actionBannerTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.primary, flex: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...SHADOW.sm,
  },
  actionGuest: { fontSize: 14.5, ...FONTS.semibold, color: COLORS.text },
  actionSep: { fontSize: 12, color: COLORS.textMut, ...FONTS.regular },
  actionMeta: { fontSize: 12.5, color: COLORS.textSec, marginTop: 2, ...FONTS.medium },
  actionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,        // never let the text column squeeze the button off-screen
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
  },
  actionCtaTxt: { fontSize: 13, ...FONTS.semibold, color: '#fff' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: SPACING.xl },
  statCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.md },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  statIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 12, ...FONTS.semibold, color: COLORS.textSec },
  statValue: { fontSize: 28, ...FONTS.bold, color: COLORS.text, marginBottom: 2, letterSpacing: -0.5 },
  statSub: { fontSize: 12, color: COLORS.textMut, ...FONTS.medium },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.xl },
  quickCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: SPACING.lg, alignItems: 'center', gap: 8, ...SHADOW.md },
  quickIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 13, ...FONTS.semibold, color: COLORS.text },
  sectionTitle: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md, letterSpacing: -0.3 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: 12, ...SHADOW.md },
  activityIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  activityInitial: { color: COLORS.onPrimary, fontSize: 16, ...FONTS.semibold },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  activitySub: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  viewBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill },
  viewBtnText: { color: COLORS.onPrimary, fontSize: 13, ...FONTS.semibold },
  chevron: { marginLeft: -4 },
});
