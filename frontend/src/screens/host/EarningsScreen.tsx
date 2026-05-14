import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import api from '../../services/api';

interface EarningsData {
  lifetime: {
    total_earnings: number;
    total_bookings: number;
    total_nights: number;
  };
  monthly: Array<{
    month: string;
    month_iso: string;
    earnings: number;
    bookings: number;
  }>;
  payout: {
    bank_name: string | null;
    account_last4: string | null;
    payout_schedule: string | null;
    next_payout_amount: number | null;
    next_payout_date: string | null;
  };
}

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = async () => {
    try {
      const res = await api.get(ENDPOINTS.HOST.EARNINGS);
      setData(res.data);
    } catch (err) {
      console.log('Earnings fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchEarnings(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const d = data;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>Earnings</Text>

        {/* Lifetime card */}
        <View style={styles.lifetimeCard}>
          <Text style={styles.lifetimeLabel}>Lifetime earned</Text>
          <Text style={styles.lifetimeAmount}>{formatCurrency(d?.lifetime.total_earnings || 0)}</Text>
          <Text style={styles.lifetimeSub}>
            {(d?.lifetime.total_bookings || 0) === 0
              ? 'No bookings yet'
              : `${d?.lifetime.total_bookings} booking${d?.lifetime.total_bookings === 1 ? '' : 's'} · ${d?.lifetime.total_nights} night${d?.lifetime.total_nights === 1 ? '' : 's'}`
            }
          </Text>
        </View>

        {/* Monthly breakdown */}
        {d?.monthly && d.monthly.length > 0 ? (
          d.monthly.map((m, i) => (
            <View key={m.month_iso || i} style={styles.monthCard}>
              <View>
                <Text style={styles.monthName}>{m.month}</Text>
                <Text style={styles.monthBookings}>{m.bookings} bookings</Text>
              </View>
              <Text style={styles.monthEarnings}>{formatCurrency(m.earnings)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyMonth}>
            <Text style={styles.emptyText}>No earnings data yet</Text>
          </View>
        )}

        {/* Payout info */}
        {d?.payout.bank_name ? (
          <View style={styles.payoutCard}>
            <Text style={styles.payoutTitle}>Payout</Text>
            <Text style={styles.payoutBank}>
              {d.payout.bank_name} ****{d.payout.account_last4} · {d.payout.payout_schedule}
            </Text>
            {d.payout.next_payout_amount && (
              <Text style={styles.payoutNext}>
                Next: {formatCurrency(d.payout.next_payout_amount)} on {d.payout.next_payout_date}
              </Text>
            )}
          </View>
       ) : (
          <View style={styles.payoutCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm }}>
              <Ionicons name="alert-circle-outline" size={22} color={COLORS.accent} />
              <Text style={styles.payoutTitle}>Payout account required</Text>
            </View>
            <Text style={styles.payoutBank}>
              Add and verify your bank account to receive payouts from bookings.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.primary,
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: RADIUS.md,
                alignSelf: 'flex-start',
                marginTop: SPACING.sm,
              }}
              onPress={() => {
                // Navigate to PaymentMethodsScreen
                // This depends on how ProfileMenu handles sub-screens
                Alert.alert('Add Account', 'Go to Profile → Payment Methods to add your bank account or UPI.');
              }}
            >
              <Text style={{ color: '#fff', ...FONTS.semibold, fontSize: 14 }}>Add payout account</Text>
            </TouchableOpacity>
          </View>
)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  scrollContent: { paddingBottom: SPACING.xl },

  pageTitle: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.lg },

  lifetimeCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  lifetimeLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', ...FONTS.medium, marginBottom: SPACING.xs },
  lifetimeAmount: { fontSize: 36, ...FONTS.bold, color: '#FFFFFF', marginBottom: SPACING.xs },
  lifetimeSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', ...FONTS.medium },

  monthCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  monthName: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  monthBookings: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  monthEarnings: { fontSize: 16, ...FONTS.bold, color: COLORS.primary },

  emptyMonth: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.textMut },

  payoutCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  payoutTitle: { fontSize: 15, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xs },
  payoutBank: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },
  payoutNext: { fontSize: 13, color: COLORS.textMut, marginTop: 4 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md },
  brand: { fontSize: 22, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, ...FONTS.bold },
});
