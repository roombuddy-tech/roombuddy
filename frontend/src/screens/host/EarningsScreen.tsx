import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
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
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayouts, setShowPayouts] = useState(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'processing': return '#3B82F6';
      case 'failed': return '#EF4444';
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
          <View style={[styles.payoutSummaryCard, { borderLeftColor: '#10B981' }]}>
            <Text style={styles.payoutSummaryLabel}>Paid out</Text>
            <Text style={[styles.payoutSummaryValue, { color: '#10B981' }]}>
              {formatCurrency(ps?.total_paid_out || 0)}
            </Text>
          </View>
          <View style={[styles.payoutSummaryCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.payoutSummaryLabel}>Pending</Text>
            <Text style={[styles.payoutSummaryValue, { color: '#F59E0B' }]}>
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
                  : 'No payout account added'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMut} />
        </TouchableOpacity>

        {/* No payout account warning */}
        {!d?.payout.bank_name && (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.accent} />
            <Text style={styles.warningText}>
              Add a bank account or UPI in Profile → Payment Methods to receive payouts.
            </Text>
          </View>
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

      {/* Payout History Modal */}
      <Modal visible={showPayouts} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPayouts(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payout History</Text>
            <View style={{ width: 24 }} />
          </View>

          {payoutsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}>
              {/* Total summary */}
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryLabel}>Total paid out</Text>
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
                    style={styles.payoutCard}
                    activeOpacity={0.7}
                    onPress={() => setExpandedPayout(expandedPayout === p.id ? null : p.id)}
                  >
                    {/* Top row: amount + status */}
                    <View style={styles.payoutTopRow}>
                      <Text style={styles.payoutAmount}>{formatCurrency(p.amount)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(p.status) + '15' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(p.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(p.status) }]}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    {/* Details row */}
                    <Text style={styles.payoutDetails}>
                      {formatDate(p.initiated_at)}
                      {p.bank_name ? `  ·  ${p.bank_name} ****${p.account_last4}` : ''}
                    </Text>
                    <Text style={styles.payoutMethod}>
                      {getMethodLabel(p.method)}
                      {p.transfer_reference ? `  ·  Ref: ${p.transfer_reference}` : ''}
                    </Text>

                    {p.booking_count > 0 && (
                      <Text style={styles.payoutBookingCount}>
                        {p.booking_count} booking{p.booking_count === 1 ? '' : 's'} included
                        <Text style={{ color: COLORS.primary }}> {expandedPayout === p.id ? '▲' : '▼'}</Text>
                      </Text>
                    )}

                    {/* Expanded booking details */}
                    {expandedPayout === p.id && p.bookings.length > 0 && (
                      <View style={styles.bookingsList}>
                        {p.bookings.map((b, i) => (
                          <View key={b.booking_code || i} style={styles.bookingRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.bookingCode}>{b.booking_code}</Text>
                              <Text style={styles.bookingGuest}>
                                {b.guest_name} · {b.nights} night{b.nights === 1 ? '' : 's'}
                              </Text>
                              <Text style={styles.bookingDates}>{b.check_in} → {b.check_out}</Text>
                            </View>
                            <Text style={styles.bookingAmount}>{formatCurrency(b.host_receives)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Notes */}
                    {p.notes && expandedPayout === p.id && (
                      <Text style={styles.payoutNotes}>Note: {p.notes}</Text>
                    )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  scrollContent: { paddingBottom: SPACING.xl },

  pageTitle: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.lg },

  // Lifetime card
  lifetimeCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  lifetimeLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', ...FONTS.medium, marginBottom: SPACING.xs },
  lifetimeAmount: { fontSize: 36, ...FONTS.bold, color: '#FFFFFF', marginBottom: SPACING.xs },
  lifetimeSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', ...FONTS.medium },

  // Payout summary row
  payoutSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  payoutSummaryCard: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  payoutSummaryLabel: { fontSize: 12, color: COLORS.textMut, ...FONTS.medium, marginBottom: 4 },
  payoutSummaryValue: { fontSize: 20, ...FONTS.bold },

  // Payout history button
  payoutHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
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
    backgroundColor: '#FFF0ED',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  warningText: { flex: 1, fontSize: 13, color: COLORS.accent, lineHeight: 19 },

  // Section
  sectionTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.md },

  // Monthly
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
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  modalSummaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', ...FONTS.medium },
  modalSummaryValue: { fontSize: 32, ...FONTS.bold, color: '#fff', marginVertical: 4 },
  modalSummaryCount: { fontSize: 13, color: 'rgba(255,255,255,0.5)', ...FONTS.medium },

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

  // Payout card
  payoutCard: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  payoutTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  payoutAmount: { fontSize: 20, ...FONTS.bold, color: COLORS.text },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, ...FONTS.semibold },
  payoutDetails: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },
  payoutMethod: { fontSize: 12, color: COLORS.textMut, marginTop: 2 },
  payoutBookingCount: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium, marginTop: 8 },

  // Expanded bookings
  bookingsList: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bookingCode: { fontSize: 13, ...FONTS.semibold, color: COLORS.primary },
  bookingGuest: { fontSize: 12, color: COLORS.textSec, marginTop: 1 },
  bookingDates: { fontSize: 11, color: COLORS.textMut, marginTop: 1 },
  bookingAmount: { fontSize: 14, ...FONTS.bold, color: COLORS.text },

  payoutNotes: {
    fontSize: 12,
    color: COLORS.textMut,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});