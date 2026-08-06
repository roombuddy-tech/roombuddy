import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, RADIUS, SPACING, ThemeColors, ThemeShadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import type { HostStackParamList } from '../../navigation/types';
import api from '../../services/api';
import { startConversation } from '../../services/chat';

type Nav = NativeStackNavigationProp<HostStackParamList, 'BookingDetail'>;
type Route = RouteProp<HostStackParamList, 'BookingDetail'>;

const makeStatusColors = (COLORS: ThemeColors): Record<string, { text: string; bg: string }> => ({
  active: { text: COLORS.success, bg: COLORS.accentSoft },
  accepted: { text: COLORS.success, bg: COLORS.accentSoft },
  pending: { text: COLORS.primaryDark, bg: COLORS.raised },
  completed: { text: COLORS.textSec, bg: COLORS.chip },
  cancelled_by_guest: { text: COLORS.danger, bg: COLORS.raised },
  cancelled_by_host: { text: COLORS.danger, bg: COLORS.raised },
  rejected: { text: COLORS.danger, bg: COLORS.raised },
  expired: { text: COLORS.textMut, bg: COLORS.chip },
});

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1);
}

function DetailRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function mapApiToBooking(d: any): any {
  return {
    booking_id: d.booking_id,
    booking_code: d.booking_code,
    status: d.status,
    guest_name: d.guest?.name ?? '',
    guest_initials: d.guest?.initials ?? '',
    guest_purpose: d.guest_purpose ?? null,
    check_in_date: d.check_in_date,
    check_out_date: d.check_out_date,
    nights: d.nights,
    rental_type: d.rental_type ?? 'nightly',
    monthly: d.monthly ?? null,
    total_guest_pays: d.pricing?.total_guest_pays ?? 0,
    total_host_receives: d.pricing?.total_host_receives ?? 0,
    subtotal: d.pricing?.subtotal ?? 0,
    meal_option_selected: d.pricing?.meal_option_selected ?? false,
    meal_cost_per_day: d.pricing?.meal_cost_per_day ?? null,
    meal_total: d.pricing?.meal_total ?? null,
  };
}

export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const STATUS_COLORS = useMemo(() => makeStatusColors(COLORS), [COLORS]);
  const paramBooking = route.params.booking;

  const needsFetch = !paramBooking.status;
  const [booking, setBooking] = useState<any>(needsFetch ? null : paramBooking);
  const [loading, setLoading] = useState(needsFetch);

  useEffect(() => {
    // Always fetch full detail to get complete pricing/meal info, even when
    // basic booking data was passed via navigation params.
    (async () => {
      try {
        const res = await api.get(`/api/bookings/${paramBooking.booking_id}/`);
        setBooking(mapApiToBooking(res.data));
      } catch {
        if (needsFetch) {
          Alert.alert('Error', 'Could not load booking details.');
          navigation.goBack();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [paramBooking.booking_id, needsFetch]);

  const messageGuest = async () => {
    if (!booking) return;
    try {
      const convo = await startConversation(booking.booking_id);
      const chatOff = ['cancelled_by_guest', 'cancelled_by_host', 'rejected', 'expired'].includes(booking.status);
      navigation.navigate('Chat', {
        conversationId: convo.conversation_id,
        title: booking.guest_name,
        subtitle: convo.listing_title ?? undefined,
        chatDisabled: chatOff,
        listingId: convo.listing_id ?? undefined,
      });
    } catch {
      // network error — screen stays as-is; user can retry
    }
  };

  const [bookingStatus, setBookingStatus] = useState<string>(paramBooking.status ?? '');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (booking?.status && !bookingStatus) setBookingStatus(booking.status);
  }, [booking]);

  const statusStyle = STATUS_COLORS[bookingStatus] || STATUS_COLORS.pending;


  const respond = async (action: 'accept' | 'decline') => {
    const label = action === 'accept' ? 'Accept' : 'Decline';
    Alert.alert(
      `${label} booking?`,
      action === 'accept'
        ? `Accept ${booking.guest_name}'s booking request?`
        : `Decline ${booking.guest_name}'s booking request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: action === 'decline' ? 'destructive' : 'default',
          onPress: async () => {
            setResponding(true);
            try {
              const res = await api.post(
                `/api/bookings/${booking.booking_id}/respond/`,
                { action },
              );
              setBookingStatus(res.data.status);
            } catch {
              Alert.alert('Error', 'Could not process your response. Please try again.');
            } finally {
              setResponding(false);
            }
          },
        },
      ],
    );
  };

  if (loading || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking details</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isMonthly = booking.rental_type === 'monthly';
  const mb = booking.monthly;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.guestCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{booking.guest_initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guestName}>{booking.guest_name}</Text>
            {booking.guest_purpose ? (
              <Text style={styles.guestPurpose}>{booking.guest_purpose}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusTxt, { color: statusStyle.text }]}>
              {formatStatus(bookingStatus)}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.msgButton} onPress={messageGuest} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primary} />
          <Text style={styles.msgButtonTxt}>Message guest</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stay details</Text>
          <DetailRow styles={styles} label="Booking code" value={booking.booking_code} />
          {isMonthly ? (
            <DetailRow styles={styles} label="Move-in" value={formatDate(booking.check_in_date)} />
          ) : (
            <>
              <DetailRow styles={styles} label="Check-in" value={formatDate(booking.check_in_date)} />
              <DetailRow styles={styles} label="Check-out" value={formatDate(booking.check_out_date)} />
              <DetailRow styles={styles} label="Nights" value={`${booking.nights} night${booking.nights > 1 ? 's' : ''}`} />
            </>
          )}
        </View>

        {isMonthly && mb ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <DetailRow
              styles={styles}
              label="Monthly rent + charges"
              value={`₹${Math.round(mb.recurring_monthly).toLocaleString('en-IN')}/mo`}
            />
            <DetailRow
              styles={styles}
              label="Security deposit"
              value={`₹${Math.round(mb.security_deposit).toLocaleString('en-IN')}`}
            />
            {mb.setup_cost_onetime > 0 ? (
              <DetailRow
                styles={styles}
                label={`Setup${mb.setup_cost_refundable ? ' (refundable)' : ''}`}
                value={`₹${Math.round(mb.setup_cost_onetime).toLocaleString('en-IN')}`}
              />
            ) : null}
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Collect at move-in</Text>
              <Text style={styles.earningsValue}>
                ₹{Math.round(mb.move_in_cost).toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={styles.earningsNote}>
              You receive 100% directly from the guest (cash / UPI). RoomBuddy only
              charges the guest a ₹49 booking fee. Then ₹{Math.round(mb.recurring_monthly).toLocaleString('en-IN')}/month.
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <DetailRow
              styles={styles}
              label="Rent"
              value={`₹${(booking.subtotal ?? booking.total_host_receives).toLocaleString('en-IN')}`}
            />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Meals</Text>
              <Text style={styles.detailValue}>
                {booking.meal_option_selected
                  ? `₹${(booking.meal_total ?? 0).toLocaleString('en-IN')}${booking.meal_cost_per_day ? ` (₹${booking.meal_cost_per_day.toLocaleString('en-IN')}/day)` : ''}`
                  : 'Not opted'}
              </Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>You receive</Text>
              <Text style={styles.earningsValue}>
                ₹{booking.total_host_receives.toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={styles.earningsNote}>
              Collect directly from the guest (cash / UPI) at check-in.
            </Text>
          </View>
        )}

        {bookingStatus === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => respond('decline')}
              disabled={responding}
              activeOpacity={0.8}
            >
              {responding
                ? <ActivityIndicator size="small" color={COLORS.danger} />
                : <Text style={styles.rejectTxt}>Decline</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => respond('accept')}
              disabled={responding}
              activeOpacity={0.8}
            >
              {responding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.acceptTxt}>Accept</Text>}
            </TouchableOpacity>
          </View>
        )}

        {bookingStatus === 'accepted' && (
          <View style={styles.acceptedBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#047857" />
            <Text style={styles.acceptedBannerTxt}>Booking accepted</Text>
          </View>
        )}

        {bookingStatus === 'rejected' && (
          <View style={styles.rejectedBanner}>
            <Ionicons name="close-circle" size={18} color={COLORS.danger} />
            <Text style={styles.rejectedBannerTxt}>Booking declined</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 17, ...FONTS.semibold, color: COLORS.text },
  acceptedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#D1FAE5', borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
  },
  acceptedBannerTxt: { fontSize: 15, ...FONTS.semibold, color: '#047857' },
  rejectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
  },
  rejectedBannerTxt: { fontSize: 15, ...FONTS.semibold, color: COLORS.danger },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },

  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarTxt: { fontSize: 16, ...FONTS.bold, color: COLORS.primary },
  guestName: { fontSize: 16, ...FONTS.semibold, color: COLORS.text },
  guestPurpose: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  statusTxt: { fontSize: 12, ...FONTS.semibold },

  section: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.textSec, marginBottom: SPACING.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 14, color: COLORS.textSec },
  detailValue: { fontSize: 14, ...FONTS.medium, color: COLORS.text },

  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  earningsLabel: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  earningsValue: { fontSize: 15, ...FONTS.bold, color: COLORS.primary },
  earningsNote: { fontSize: 12, color: COLORS.textMut, marginTop: 6, lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  rejectBtn: { borderWidth: 1.5, borderColor: COLORS.border },
  acceptBtn: { backgroundColor: COLORS.primary },
  rejectTxt: { fontSize: 15, ...FONTS.medium, color: COLORS.textSec },
  acceptTxt: { fontSize: 15, ...FONTS.semibold, color: '#fff' },
  msgButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 12, marginBottom: SPACING.lg,
  },
  msgButtonTxt: { fontSize: 15, ...FONTS.semibold, color: COLORS.primary },
});
