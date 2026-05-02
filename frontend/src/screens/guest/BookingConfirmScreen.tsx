import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import type { GuestStackParamList } from '../../navigation/types';
import { createBooking, getQuote } from '../../services/bookings';
import { createPaymentOrder } from '../../services/payments';
import type { BookingQuote } from '../../types/booking';
import { getErrorMessage } from '../../utils/errors';

type Nav = NativeStackNavigationProp<GuestStackParamList, 'BookingConfirm'>;
type Rt = RouteProp<GuestStackParamList, 'BookingConfirm'>;

export default function BookingConfirmScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { listingId, listingTitle, checkIn, checkOut, numberOfGuests = 1 } = route.params;

  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = await getQuote(listingId, checkIn, checkOut);
        if (!cancelled) setQuote(q);
      } catch (e: any) {
        if (!cancelled) setError(getErrorMessage(e, 'Could not fetch quote'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [listingId, checkIn, checkOut]);

  async function handleConfirmAndPay() {
    if (!quote) return;
    setSubmitting(true);
    try {
      const booking = await createBooking({
        listingId,
        checkIn,
        checkOut,
        numberOfGuests,
      });

      const order = await createPaymentOrder(booking.booking_id);

      navigation.replace('RazorpayCheckout', {
        bookingId: booking.booking_id,
        bookingCode: booking.booking_code,
        order,
      });
    } catch (e: any) {
      Alert.alert('Booking failed', getErrorMessage(e, 'Could not start booking'))
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !quote) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
        <Text style={styles.errorText}>{error || 'Quote unavailable'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm and pay</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.listingTitle} numberOfLines={2}>{listingTitle}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Check-in</Text>
            <Text style={styles.value}>{formatDate(checkIn)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Check-out</Text>
            <Text style={styles.value}>{formatDate(checkOut)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Guests</Text>
            <Text style={styles.value}>{numberOfGuests}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nights</Text>
            <Text style={styles.value}>{quote.nights}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Price details</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              ₹{quote.host_nightly_price.toLocaleString('en-IN')} × {quote.nights} nights
            </Text>
            <Text style={styles.priceValue}>₹{quote.subtotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>GST</Text>
            <Text style={styles.priceValue}>₹{quote.gst_amount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service fee</Text>
            <Text style={styles.priceValue}>₹{quote.platform_fee.toLocaleString('en-IN')}</Text>
          </View>
          {quote.security_deposit > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Security deposit (refundable)</Text>
              <Text style={styles.priceValue}>₹{quote.security_deposit.toLocaleString('en-IN')}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total ({quote.currency})</Text>
            <Text style={styles.totalValue}>₹{quote.total_guest_pays.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={[styles.card, { flexDirection: 'row', alignItems: 'flex-start' }]}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.policyText}>
            Cancellation policies vary by listing. You'll see the exact refund amount when you cancel.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, submitting && styles.payBtnDisabled]}
          onPress={handleConfirmAndPay}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.payBtnText}>
                Confirm and pay ₹{quote.total_guest_pays.toLocaleString('en-IN')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: SPACING.lg },
  errorText: { fontSize: 16, color: COLORS.text, textAlign: 'center', marginTop: SPACING.md, ...FONTS.medium },
  retryBtn: { marginTop: SPACING.lg, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: COLORS.primary, borderRadius: RADIUS.md },
  retryText: { color: '#fff', ...FONTS.semibold },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: 60, paddingBottom: SPACING.md,
    backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, ...FONTS.semibold, color: COLORS.text },
  scroll: { padding: SPACING.md, paddingBottom: 120 },
  card: { backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  listingTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },
  cardTitle: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, marginBottom: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 14, color: COLORS.textSec },
  value: { fontSize: 14, color: COLORS.text, ...FONTS.medium },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  priceLabel: { fontSize: 14, color: COLORS.textSec, flex: 1 },
  priceValue: { fontSize: 14, color: COLORS.text, ...FONTS.medium },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  totalLabel: { fontSize: 16, color: COLORS.text, ...FONTS.bold },
  totalValue: { fontSize: 16, color: COLORS.text, ...FONTS.bold },
  policyText: { flex: 1, fontSize: 13, color: COLORS.textSec, marginLeft: SPACING.sm, lineHeight: 18 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.md, backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 32,
  },
  payBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingVertical: 16, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  payBtnDisabled: { backgroundColor: COLORS.primaryLight },
  payBtnText: { color: '#fff', fontSize: 16, ...FONTS.bold },
});