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
  const avatarBgCycle = [COLORS.primaryAlpha, COLORS.accentSoft, COLORS.chip];

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
              <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.primary} />
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

        {/* Stats grid — 2x2, each card with a distinct tinted background */}
        <View style={styles.statsGrid}>
          {/* Card 1: THIS MONTH — light green */}
          <View style={[styles.statCard, { backgroundColor: 'rgba(63,122,82,0.12)' }]}>
            <Text style={styles.statLabel}>THIS MONTH</Text>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              ₹{(d?.this_month.earnings || 0).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.statSub}>
              {(d?.this_month.bookings || 0) === 0 ? 'No bookings yet' : `${d?.this_month.bookings} bookings`}
            </Text>
          </View>

          {/* Card 2: OCCUPANCY — light amber */}
          <View style={[styles.statCard, { backgroundColor: 'rgba(200,146,60,0.12)' }]}>
            <Text style={styles.statLabel}>OCCUPANCY</Text>
            <Text style={[styles.statValue, { color: COLORS.star }]}>
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

          {/* Card 3: AVG RATING — light amber */}
          <View style={[styles.statCard, { backgroundColor: 'rgba(200,146,60,0.12)' }]}>
            <Text style={styles.statLabel}>AVG RATING</Text>
            <Text style={[styles.statValue, { color: COLORS.star }]}>
              {d?.this_month.avg_rating != null ? `${d.this_month.avg_rating} ★` : '—'}
            </Text>
            <Text style={styles.statSub}>
              {(d?.this_month.review_count || 0) === 0 ? 'No reviews yet' : `${d?.this_month.review_count} reviews`}
            </Text>
          </View>

          {/* Card 4: RESPONSE — light lavender */}
          <View style={[styles.statCard, { backgroundColor: 'rgba(100,80,180,0.12)' }]}>
            <Text style={styles.statLabel}>RESPONSE</Text>
            <Text style={[styles.statValue, { color: '#7C5CBF' }]}>
              {d?.this_month.response_rate_pct != null ? `${d.this_month.response_rate_pct}%` : '—'}
            </Text>
            <Text style={styles.statSub}>
              {d?.this_month.response_rate_pct != null ? 'This month' : 'No requests yet'}
            </Text>
          </View>
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
                <View style={[styles.activityIcon, { backgroundColor: COLORS.accentSoft }]}>
                  <Text style={[styles.activityInitial, { color: COLORS.accent }]}>{guestInitial}</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryAlpha, borderRadius: RADIUS.pill,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  switchBtnTxt: { fontSize: 12, color: COLORS.primary, ...FONTS.semibold },
  bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.chip, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 11, color: COLORS.textSec, ...FONTS.semibold, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
  name: { fontSize: 32, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5, marginBottom: SPACING.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.xl },
  statCard: { width: '48%', borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.sm },
  statLabel: { fontSize: 11, ...FONTS.semibold, letterSpacing: 1.1, textTransform: 'uppercase', color: COLORS.textSec, marginBottom: 4 },
  statValue: { fontSize: 28, ...FONTS.serif, marginBottom: 2 },
  statSub: { fontSize: 12, color: COLORS.textSec, ...FONTS.medium },
  sectionTitle: { fontSize: 20, ...FONTS.semibold, color: COLORS.text, marginBottom: SPACING.md },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: 12 },
  activityIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  activityInitial: { color: COLORS.onPrimary, fontSize: 16, ...FONTS.semibold },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  activitySub: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  viewBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill },
  viewBtnText: { color: COLORS.onPrimary, fontSize: 13, ...FONTS.semibold },
  chevron: { marginLeft: -4 },
});
