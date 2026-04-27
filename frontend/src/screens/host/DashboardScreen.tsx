import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import ProfileMenu from '../../screens/shared/ProfileMenu';

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
    check_ins: Array<{ booking_code: string; guest_name: string; nights: number; check_in_time: string }>;
    check_outs: Array<{ booking_code: string; guest_name: string }>;
    recent_reviews: Array<{ reviewer_name: string; rating: number; body: string; submitted_at: string }>;
  };
}

export default function DashboardScreen() {
  const { switchRole, user } = useAuth();
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
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
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
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.brand}>Room<Text style={styles.brandAccent}>Buddy</Text></Text>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)}>
            <Text style={styles.avatarText}>{initial}</Text>
          </TouchableOpacity>
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

        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.name}>{name} 👋</Text>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#E6F5F0' }]}>
            <Text style={[styles.statLabel, { color: COLORS.primary }]}>This month</Text>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>₹{(d?.this_month.earnings || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.statSub}>{d?.this_month.bookings || 0} bookings</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FFF8E6' }]}>
            <Text style={[styles.statLabel, { color: '#B8860B' }]}>Occupancy</Text>
            <Text style={[styles.statValue, { color: '#B8860B' }]}>{d?.this_month.occupancy_pct || 0}%</Text>
            <Text style={styles.statSub}>{d?.this_month.occupancy_nights_booked || 0}/{d?.this_month.occupancy_nights_total || 30} nights</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E6F5F0' }]}>
            <Text style={[styles.statLabel, { color: COLORS.primary }]}>Avg rating</Text>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>{d?.this_month.avg_rating || '—'}</Text>
            <Text style={styles.statSub}>{d?.this_month.review_count || 0} reviews</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FFF8E6' }]}>
            <Text style={[styles.statLabel, { color: '#B8860B' }]}>Response</Text>
            <Text style={[styles.statValue, { color: '#B8860B' }]}>{d?.this_month.response_rate_pct || 0}%</Text>
            <Text style={styles.statSub}>&lt; 1hr avg</Text>
          </View>
        </View>

        {/* Today section */}
        <Text style={styles.sectionTitle}>Today</Text>

        {d?.today.check_ins && d.today.check_ins.length > 0 ? (
          d.today.check_ins.map((ci, i) => (
            <View key={i} style={styles.activityCard}>
              <View style={[styles.activityIcon, { backgroundColor: '#FFF8E6' }]}>
                <Text style={{ fontSize: 20 }}>🔑</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{ci.guest_name} checks in today</Text>
                <Text style={styles.activitySub}>{ci.nights}-day stay · {ci.check_in_time}</Text>
              </View>
              <TouchableOpacity style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>View</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.activityCard}>
            <View style={[styles.activityIcon, { backgroundColor: COLORS.surface }]}>
              <Text style={{ fontSize: 20 }}>📅</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>No check-ins today</Text>
              <Text style={styles.activitySub}>You're all clear!</Text>
            </View>
          </View>
        )}

        {d?.today.check_outs && d.today.check_outs.length > 0 && (
          d.today.check_outs.map((co, i) => (
            <View key={`co-${i}`} style={styles.activityCard}>
              <View style={[styles.activityIcon, { backgroundColor: '#E6F5F0' }]}>
                <Text style={{ fontSize: 20 }}>👋</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{co.guest_name} checks out today</Text>
              </View>
            </View>
          ))
        )}

        {d?.today.recent_reviews && d.today.recent_reviews.length > 0 && (
          d.today.recent_reviews.map((rv, i) => (
            <View key={`rv-${i}`} style={styles.activityCard}>
              <View style={[styles.activityIcon, { backgroundColor: '#FFF8E6' }]}>
                <Text style={{ fontSize: 20 }}>⭐</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>New review from {rv.reviewer_name}</Text>
                <Text style={styles.activitySub}>{'★'.repeat(rv.rating)} {rv.body}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, marginTop: SPACING.sm },
  brand: { fontSize: 22, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, ...FONTS.bold },
  toggleRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.lg },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.sm },
  toggleActiveHost: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  toggleText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  toggleEmoji: { fontSize: 14 },
  toggleActiveTextHost: { fontSize: 14, color: COLORS.accent, ...FONTS.semibold },
  greeting: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  name: { fontSize: 28, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.xl },
  statCard: { width: '48%', borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm },
  statLabel: { fontSize: 12, ...FONTS.semibold, marginBottom: 4 },
  statValue: { fontSize: 26, ...FONTS.bold, marginBottom: 2 },
  statSub: { fontSize: 12, color: COLORS.textMut, ...FONTS.medium },
  sectionTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: 12 },
  activityIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  activitySub: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  viewBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill },
  viewBtnText: { color: '#fff', fontSize: 13, ...FONTS.semibold },
});