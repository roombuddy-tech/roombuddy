/**
 * BookingDetailScreen — host view of a single booking.
 *
 * Reached from:
 * - Today screen "View" button (today's check-ins/check-outs)
 * - Bookings list card tap
 *
 * Backend: GET /api/bookings/<id>/  (auth: must be guest or host of booking)
 */
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import type { HostStackParamList } from '../../navigation/types';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

type Nav = NativeStackNavigationProp<HostStackParamList, 'BookingDetail'>;
type Rt = RouteProp<HostStackParamList, 'BookingDetail'>;

interface BookingDetail {
  booking_id: string;
  booking_code: string;
  status: string;
  payment_status: string;
  booking_mode: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  guest_purpose: string | null;
  special_requests: string | null;
  guest: {
    id: string;
    name: string;
    initials: string;
    phone: string | null;
    email: string | null;
  };
  host: { id: string; name: string };
  listing: { id: string; title: string | null };
  pricing: {
    host_nightly_price: number;
    guest_nightly_price: number;
    subtotal: number;
    gst_amount: number;
    platform_fee: number;
    security_deposit: number;
    total_guest_pays: number;
    total_host_receives: number;
    currency: string;
  };
  cancellation_policy: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  refund_amount: number | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  pending:            { bg: '#FFF8E6', fg: '#B8860B', label: 'Pending' },
  accepted:           { bg: '#E6F5F0', fg: '#0D7377', label: 'Accepted' },
  active:             { bg: '#E6F5F0', fg: '#0D7377', label: 'Active' },
  completed:          { bg: '#F7F9FA', fg: '#5F7285', label: 'Completed' },
  rejected:           { bg: '#FFF0F0', fg: '#EF4444', label: 'Rejected' },
  cancelled_by_guest: { bg: '#FFF0F0', fg: '#EF4444', label: 'Cancelled by guest' },
  cancelled_by_host:  { bg: '#FFF0F0', fg: '#EF4444', label: 'Cancelled by host' },
  expired:            { bg: '#F7F9FA', fg: '#94A3B8', label: 'Expired' },
  no_show:            { bg: '#FFF0F0', fg: '#EF4444', label: 'No show' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/bookings/${bookingId}/`);
        if (!cancelled) setBooking(res.data);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load booking'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={56} color={COLORS.danger} />
        <Text style={styles.errorText}>{error || 'Booking not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusStyle = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking details</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Booking code + status */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.codeLabel}>Booking code</Text>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.fg }]}>
                {statusStyle.label}
              </Text>
            </View>
          </View>
          <Text style={styles.code}>{booking.booking_code}</Text>
        </View>

        {/* Guest — tap to see full profile */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('GuestProfile', { userId: booking.guest.id })}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Guest</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
          </View>
          <View style={styles.guestRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{booking.guest.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestName}>{booking.guest.name}</Text>
              {booking.guest.phone && (
                <Text style={styles.guestSub}>{booking.guest.phone}</Text>
              )}
              {booking.guest.email && (
                <Text style={styles.guestSub}>{booking.guest.email}</Text>
              )}
              <Text style={styles.viewProfileHint}>View profile</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Stay */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stay</Text>
          <DetailRow label="Check-in" value={formatDate(booking.check_in_date)} />
          <DetailRow label="Check-out" value={formatDate(booking.check_out_date)} />
          <DetailRow label="Nights" value={String(booking.nights)} />
          <DetailRow label="Guests" value={String(booking.number_of_guests)} />
          {booking.guest_purpose && (
            <DetailRow label="Purpose" value={booking.guest_purpose} />
          )}
          {booking.special_requests && (
            <View style={{ marginTop: SPACING.sm }}>
              <Text style={styles.detailLabel}>Special requests</Text>
              <Text style={styles.notesText}>{booking.special_requests}</Text>
            </View>
          )}
        </View>

        {/* Pricing */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Earnings</Text>
          <DetailRow
            label={`${formatINR(booking.pricing.host_nightly_price)} × ${booking.nights} nights`}
            value={formatINR(booking.pricing.subtotal)}
          />
          {booking.pricing.security_deposit > 0 && (
            <DetailRow
              label="Security deposit"
              value={formatINR(booking.pricing.security_deposit)}
            />
          )}
          <View style={styles.divider} />
          <View style={styles.priceTotalRow}>
            <Text style={styles.totalLabel}>You receive</Text>
            <Text style={styles.totalValue}>
              {formatINR(booking.pricing.total_host_receives)}
            </Text>
          </View>
          <Text style={styles.subtleNote}>
            Guest paid {formatINR(booking.pricing.total_guest_pays)} including taxes & service fee.
          </Text>
        </View>

        {/* Cancellation block (only if cancelled or refunded) */}
        {(booking.cancelled_at || booking.refund_amount) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cancellation</Text>
            {booking.cancelled_at && (
              <DetailRow label="Cancelled on" value={formatDate(booking.cancelled_at)} />
            )}
            {booking.cancellation_policy && (
              <DetailRow
                label="Policy"
                value={
                  booking.cancellation_policy.charAt(0).toUpperCase() +
                  booking.cancellation_policy.slice(1)
                }
              />
            )}
            {booking.refund_amount !== null && (
              <DetailRow
                label="Refund issued"
                value={formatINR(booking.refund_amount)}
              />
            )}
            {booking.cancellation_reason && (
              <View style={{ marginTop: SPACING.sm }}>
                <Text style={styles.detailLabel}>Reason</Text>
                <Text style={styles.notesText}>{booking.cancellation_reason}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.bg, padding: SPACING.lg,
  },
  errorText: {
    fontSize: 16, color: COLORS.text, textAlign: 'center',
    marginTop: SPACING.md, ...FONTS.medium,
  },
  retryBtn: {
    marginTop: SPACING.lg, paddingVertical: 12, paddingHorizontal: 24,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
  },
  retryText: { color: '#fff', ...FONTS.semibold },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md,
    backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, ...FONTS.semibold, color: COLORS.text },

  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  card: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm,
  },
  cardTitle: {
    fontSize: 15, ...FONTS.semibold, color: COLORS.text,
    marginBottom: SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  viewProfileHint: {
    fontSize: 12, color: COLORS.primary, ...FONTS.semibold,
    marginTop: 6,
  },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLabel: { fontSize: 12, color: COLORS.textMut, ...FONTS.medium, textTransform: 'uppercase' },
  code: { fontSize: 20, ...FONTS.bold, color: COLORS.primary, marginTop: 4, letterSpacing: 1 },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: RADIUS.pill },
  statusText: { fontSize: 12, ...FONTS.semibold },

  guestRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, ...FONTS.bold, color: COLORS.primary },
  guestName: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  guestSub: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: { fontSize: 14, color: COLORS.textSec },
  detailValue: { fontSize: 14, color: COLORS.text, ...FONTS.medium },

  notesText: {
    fontSize: 14, color: COLORS.text, marginTop: 4, lineHeight: 20,
  },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  priceTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 16, ...FONTS.bold, color: COLORS.text },
  totalValue: { fontSize: 16, ...FONTS.bold, color: COLORS.primary },
  subtleNote: { fontSize: 12, color: COLORS.textMut, marginTop: 6 },
});
