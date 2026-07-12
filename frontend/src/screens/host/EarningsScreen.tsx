import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors, ThemeShadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import ProfileMenu from '../shared/ProfileMenu';

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
    upi_id: string | null;
    payout_schedule: string | null;
    next_payout_amount: number | null;
    next_payout_date: string | null;
  };
  payout_summary: {
    total_paid_out: number;
    pending_amount: number;
    unpaid_amount: number;
    last_payout_date: string | null;
    last_payout_amount: number | null;
  };
}

interface PayoutBooking {
  booking_code: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  host_receives: number;
}

interface PayoutItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  transfer_reference: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  initiated_at: string;
  completed_at: string | null;
  bookings: PayoutBooking[];
  booking_count: number;
  bank_name?: string;
  account_last4?: string;
}

interface PayoutsResponse {
  total_paid_out: number;
  payout_count: number;
  payouts: PayoutItem[];
}

export default function EarningsScreen() {
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayouts, setShowPayouts] = useState(false);
  const [showPaymentProfile, setShowPaymentProfile] = useState(false);
  const [payoutsData, setPayoutsData] = useState<PayoutsResponse | null>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);

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

  const fetchPayouts = async () => {
    setPayoutsLoading(true);
    try {
      const res = await api.get(ENDPOINTS.PAYMENT.HOST_PAYOUTS);
      setPayoutsData(res.data);
    } catch (err) {
      console.log('Payouts fetch error:', err);
    } finally {
      setPayoutsLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatMonthYear = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return COLORS.primary;
      case 'pending': return COLORS.textSec;
      case 'processing': return COLORS.star;
      case 'failed': return COLORS.danger;
      default: return COLORS.textMut;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'manual_bank': return 'Bank Transfer';
      case 'manual_upi': return 'UPI Transfer';
      case 'razorpay': return 'Razorpay';
      default: return method;
    }
  };

  const handleOpenPayouts = () => {
    setShowPayouts(true);
    if (!payoutsData) fetchPayouts();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const d = data;
  const ps = d?.payout_summary;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.pageTitle}>Earnings</Text>

        {/* Lifetime card */}
        <View style={styles.lifetimeCard}>
          <Text style={styles.lifetimeLabel}>Lifetime earned</Text>
          <Text style={styles.lifetimeAmount}>{formatCurrency(d?.lifetime.total_earnings || 0)}</Text>
          <Text style={styles.lifetimeSub}>
            {(d?.lifetime.total_bookings || 0) === 0
              ? 'No bookings yet'
              : `${d?.lifetime.total_bookings} booking${d!.lifetime.total_bookings === 1 ? '' : 's'} · ${d?.lifetime.total_nights} night${d!.lifetime.total_nights === 1 ? '' : 's'}`}
          </Text>
        </View>

        {/* Payout summary cards */}
        <View style={styles.payoutSummaryRow}>
          <View style={styles.payoutSummaryCard}>
            <View style={styles.payoutSummaryTop}>
              <Ionicons name="checkmark-circle-outline" size={15} color={COLORS.textSec} />
              <Text style={styles.payoutSummaryLabel}>Paid out</Text>
            </View>
            <Text style={styles.payoutSummaryValue}>
              {formatCurrency(ps?.total_paid_out || 0)}
            </Text>
          </View>
          <View style={styles.payoutSummaryCard}>
            <View style={styles.payoutSummaryTop}>
              <Ionicons name="time-outline" size={15} color={COLORS.primary} />
              <Text style={styles.payoutSummaryLabel}>Pending</Text>
            </View>
            <Text style={[styles.payoutSummaryValue, { color: COLORS.primary }]}>
              {formatCurrency((ps?.pending_amount || 0) + (ps?.unpaid_amount || 0))}
            </Text>
          </View>
        </View>

        {/* Payout History button */}
        <TouchableOpacity style={styles.payoutHistoryBtn} onPress={handleOpenPayouts}>
          <View style={styles.payoutHistoryLeft}>
            <View style={styles.payoutHistoryIcon}>
              <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.payoutHistoryTitle}>Payout History</Text>
              <Text style={styles.payoutHistorySub}>
                {d?.payout.bank_name
                  ? `${d.payout.bank_name} ****${d.payout.account_last4}`
                  : d?.payout.upi_id
                  ? `UPI · ${d.payout.upi_id}`
                  : 'No payout account added'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMut} />
        </TouchableOpacity>

        {/* No payout account warning */}
        {!d?.payout.bank_name && !d?.payout.upi_id && (
          <TouchableOpacity style={styles.warningCard} activeOpacity={0.7} onPress={() => setShowPaymentProfile(true)}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.warningText}>
              Add a bank account or UPI to receive payouts. Tap to add now.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Monthly breakdown */}
        <Text style={styles.sectionTitle}>Monthly breakdown</Text>
        {d?.monthly && d.monthly.length > 0 ? (
          d.monthly.map((m, i) => (
            <View key={m.month_iso || i} style={styles.monthCard}>
              <View>
                <Text style={styles.monthName}>{m.month}</Text>
                <Text style={styles.monthBookings}>
                  {m.bookings === 0 ? 'No bookings' : `${m.bookings} booking${m.bookings === 1 ? '' : 's'}`}
                </Text>
              </View>
              <Text style={styles.monthEarnings}>{formatCurrency(m.earnings)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyMonth}>
            <Text style={styles.emptyText}>No earnings data yet</Text>
          </View>
        )}
      </ScrollView>

      <ProfileMenu visible={showPaymentProfile} onClose={() => setShowPaymentProfile(false)} initialScreen="payment" />

      {/* Payout History Modal */}
      <Modal visible={showPayouts} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPayouts(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payout history</Text>
            <View style={{ width: 24 }} />
          </View>

          {payoutsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}>
              {/* Total summary dark card */}
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryLabel}>TOTAL PAID OUT</Text>
                <Text style={styles.modalSummaryValue}>
                  {formatCurrency(payoutsData?.total_paid_out || 0)}
                </Text>
                <Text style={styles.modalSummaryCount}>
                  {payoutsData?.payout_count || 0} payout{(payoutsData?.payout_count || 0) === 1 ? '' : 's'}
                </Text>
              </View>

              {/* Payout list */}
              {!payoutsData?.payouts?.length ? (
                <View style={styles.emptyPayouts}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="wallet-outline" size={36} color={COLORS.primary} />
                  </View>
                  <Text style={styles.emptyPayoutsTitle}>No payouts yet</Text>
                  <Text style={styles.emptyPayoutsText}>
                    Once bookings are completed, payouts will appear here.
                  </Text>
                </View>
              ) : (
                payoutsData.payouts.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.payoutRow}
                    activeOpacity={0.7}
                    onPress={() => setExpandedPayout(expandedPayout === p.id ? null : p.id)}
                  >
                    {/* Checkmark icon */}
                    <View style={[styles.payoutRowIcon, { backgroundColor: getStatusColor(p.status) + '18' }]}>
                      <Ionicons name="checkmark" size={18} color={getStatusColor(p.status)} />
                    </View>

                    {/* Amount + details */}
                    <View style={styles.payoutRowContent}>
                      <Text style={styles.payoutAmount}>{formatCurrency(p.amount)}</Text>
                      <Text style={styles.payoutDetails}>
                        {formatMonthYear(p.initiated_at)}
                        {p.bank_name ? ` · ${p.bank_name} ****${p.account_last4}` : p.transfer_reference ? ` · Ref: ${p.transfer_reference}` : ''}
                      </Text>
                    </View>

                    {/* Status pill */}
                    <View style={[styles.payoutStatusPill, { backgroundColor: getStatusColor(p.status) + '18' }]}>
                      <Text style={[styles.payoutStatusTxt, { color: getStatusColor(p.status) }]}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  scrollContent: { paddingBottom: SPACING.xl },

  pageTitle: { fontSize: 30, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5, marginTop: SPACING.sm, marginBottom: SPACING.lg },

  // Lifetime card
  lifetimeCard: {
    backgroundColor: COLORS.primaryDeep,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  lifetimeLabel: { fontSize: 11, color: 'rgba(251,244,236,0.65)', ...FONTS.semibold, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: SPACING.xs },
  lifetimeAmount: { fontSize: 42, ...FONTS.serifLight, color: COLORS.onPrimary, letterSpacing: -0.8, marginBottom: SPACING.xs },
  lifetimeSub: { fontSize: 14, color: 'rgba(251,244,236,0.55)', ...FONTS.medium },

  // Payout summary row
  payoutSummaryRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  payoutSummaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.md,
  },
  payoutSummaryTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  payoutSummaryLabel: { fontSize: 12, ...FONTS.semibold, color: COLORS.textSec },
  payoutSummaryValue: { fontSize: 22, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.3 },

  // Payout history button
  payoutHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.md,
  },
  payoutHistoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payoutHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutHistoryTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  payoutHistorySub: { fontSize: 13, color: COLORS.textSec, marginTop: 1 },

  // Warning
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.raised,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  warningText: { flex: 1, fontSize: 13, color: COLORS.primaryDark, lineHeight: 19 },

  // Section
  sectionTitle: { fontSize: 20, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.3, marginTop: SPACING.md, marginBottom: SPACING.md },

  // Monthly
  monthCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.md,
  },
  monthName: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  monthBookings: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  monthEarnings: { fontSize: 18, ...FONTS.bold, color: COLORS.primary },
  emptyMonth: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.textMut },

  // ── Modal ──
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },

  modalSummary: {
    backgroundColor: COLORS.primaryDeep,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  modalSummaryLabel: { fontSize: 11, color: 'rgba(251,244,236,0.65)', ...FONTS.semibold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  modalSummaryValue: { fontSize: 42, ...FONTS.serifLight, color: COLORS.onPrimary, marginVertical: 4, letterSpacing: -1 },
  modalSummaryCount: { fontSize: 13, color: 'rgba(251,244,236,0.55)', ...FONTS.medium },

  // Empty payouts
  emptyPayouts: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyPayoutsTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.sm },
  emptyPayoutsText: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.lg },

  // Payout row (new clean design)
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  payoutRowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  payoutRowContent: { flex: 1 },
  payoutAmount: { fontSize: 17, ...FONTS.bold, color: COLORS.text },
  payoutDetails: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium, marginTop: 2 },
  payoutStatusPill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: RADIUS.pill },
  payoutStatusTxt: { fontSize: 12, ...FONTS.semibold },
});