import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SHADOW, SPACING, ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import type { GuestStackParamList } from '../../navigation/types';
import api from '../../services/api';
import { createBooking, getQuote } from '../../services/bookings';
import { createPaymentOrder } from '../../services/payments';
import type { BookingQuote } from '../../types/booking';
import { getErrorMessage } from '../../utils/errors';

type Nav = NativeStackNavigationProp<GuestStackParamList, 'BookingConfirm'>;
type Rt = RouteProp<GuestStackParamList, 'BookingConfirm'>;

// ─── Cancellation policy config ──────────────────────────────────────────────

type PolicyKey = 'flexible';

const POLICY_META: Record<PolicyKey, {
  label: string;
  tagline: string;
  color: string;
  tiers: { window: string; refund: string; highlight: boolean }[];
}> = {
  flexible: {
    label: 'Flexible',
    tagline: 'Easy cancellations for last-minute changes.',
    color: '#059669',
    tiers: [
      { window: '2+ days before check-in', refund: '100% refund', highlight: true },
      { window: 'Less than 2 days before check-in', refund: '50% refund', highlight: false },
    ],
  },
};

const POLICY_NOTES = [
  'The platform fee paid online is non-refundable on guest cancellations.',
  'Rent and the security deposit are paid directly to the host — any refund of those follows the host’s policy shown above.',
  'The refund percentages above apply to what you settle directly with the host.',
  'In extraordinary circumstances (natural disasters, government orders), RoomBuddy may help mediate.',
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookingConfirmScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const {
    listingId, listingTitle, checkIn, checkOut, numberOfGuests = 1,
    mealOption: initialMealOption = false,
    mealsAvailable = false,
    mealCostPerDay,
    mealTypes,
    mealDescription,
  } = route.params;

  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withMeals, setWithMeals] = useState(initialMealOption);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const { user } = useAuth();
  const { genderPreference } = route.params;

  const [guestProfile, setGuestProfile] = useState<{
    first_name: string;
    last_name: string;
    gender: string;
    phone_number?: string;
    phone_country_code?: string;
  } | null>(null);

  useEffect(() => {
    api.get(ENDPOINTS.USER.PROFILE).then((res) => setGuestProfile(res.data)).catch(() => {});
  }, []);

  // Gender validation
  const genderMismatch = (() => {
    if (!genderPreference || genderPreference === 'any' || !guestProfile) return false;
    if (genderPreference === 'female_only' && guestProfile.gender !== 'female') return true;
    if (genderPreference === 'male_only' && guestProfile.gender !== 'male') return true;
    return false;
  })();

  const genderLabel = genderPreference === 'female_only' ? 'Female guests only'
    : genderPreference === 'male_only' ? 'Male guests only' : '';

  useEffect(() => {
    if (genderMismatch && guestProfile) {
      Alert.alert(
        'Cannot book this property',
        `This listing is for ${genderLabel.toLowerCase()}. Your profile gender (${guestProfile.gender}) does not match.\n\nPlease look for other listings that match your profile.`,
        [
          { text: 'Go back', onPress: () => navigation.goBack() },
          { text: 'Stay here', style: 'cancel' },
        ],
      );
    }
  }, [genderMismatch, guestProfile]);

  const fetchQuote = async (mealOpt: boolean) => {
    setLoading(true);
    try {
      const q = await getQuote(listingId, checkIn, checkOut, mealOpt);
      setQuote(q);
    } catch (e: any) {
      setError(getErrorMessage(e, 'Could not fetch quote'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuote(withMeals); }, [listingId, checkIn, checkOut]);

  const toggleMeals = (val: boolean) => { setWithMeals(val); fetchQuote(val); };

  async function handleConfirmAndPay() {
    if (!quote) return;
    setSubmitting(true);
    try {
      const booking = await createBooking({ listingId, checkIn, checkOut, numberOfGuests, mealOption: withMeals });
      const order = await createPaymentOrder(booking.booking_id);
      navigation.replace('RazorpayCheckout', { bookingId: booking.booking_id, bookingCode: booking.booking_code, order });
    } catch (e: any) {
      Alert.alert('Booking failed', getErrorMessage(e, 'Could not start booking'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
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

const policyKey: PolicyKey = 'flexible';
const policyMeta =  POLICY_META.flexible;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CONFIRM AND PAY</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Stay details */}
        <View style={styles.card}>
          <View style={styles.eyebrowRow}>
            <View style={styles.accentBar} />
            <Text style={styles.eyebrow}>Your stay</Text>
          </View>
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
          <View style={[styles.row, styles.lastRow]}>
            <Text style={styles.label}>Nights</Text>
            <Text style={styles.value}>{quote.nights}</Text>
          </View>
        </View>

        {/* Guest details — booking is for the logged-in user */}
        <View style={styles.card}>
          <View style={styles.eyebrowRow}>
            <View style={styles.accentBar} />
            <Text style={styles.eyebrow}>Booking for</Text>
          </View>
          {guestProfile ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{guestProfile.first_name} {guestProfile.last_name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Gender</Text>
                <Text style={styles.value}>{guestProfile.gender.charAt(0).toUpperCase() + guestProfile.gender.slice(1)}</Text>
              </View>
              <View style={[styles.row, styles.lastRow]}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>
                  {guestProfile.phone_number
                    ? `${guestProfile.phone_country_code ?? ''}${guestProfile.phone_number}`
                    : (user?.phone_number ? `${user.phone_country_code ?? ''}${user.phone_number}` : '—')}
                </Text>
              </View>
            </>
          ) : (
            <ActivityIndicator size="small" color={COLORS.primary} />
          )}
        </View>

        {/* Gender mismatch warning */}
        {genderMismatch && (
          <View style={styles.alertCard}>
            <Ionicons name="alert-circle" size={22} color={COLORS.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                Gender restriction
              </Text>
              <Text style={styles.alertText}>
                This property is listed for {genderLabel.toLowerCase()}. Your profile gender ({guestProfile?.gender}) does not match. You cannot book this listing.
              </Text>
            </View>
          </View>
        )}

        {/* Meal option */}
        {quote.meals_available && (
          <View style={styles.card}>
            <View style={styles.mealHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.eyebrowRow}>
                  <View style={styles.accentBar} />
                  <Text style={styles.eyebrow}>Meals</Text>
                </View>
                <Text style={styles.mealTitle}>Home cooked meals</Text>
                {quote.meal_types && <Text style={styles.mealTypes}>Includes: {quote.meal_types}</Text>}
                {quote.meal_cost_per_day !== null && (
                  <Text style={styles.mealCost}>₹{quote.meal_cost_per_day.toLocaleString('en-IN')}/day</Text>
                )}
              </View>
              <Switch
                value={withMeals}
                onValueChange={toggleMeals}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
                ios_backgroundColor={COLORS.border}
              />
            </View>
            {mealDescription ? <Text style={styles.mealDesc}>{mealDescription}</Text> : null}
          </View>
        )}

        {/* Pay now (via RoomBuddy) */}
        <View style={styles.card}>
          <View style={styles.eyebrowRow}>
            <View style={styles.accentBar} />
            <Text style={styles.eyebrow}>Pay now</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform fee</Text>
            <Text style={styles.priceValue}>₹{quote.platform_fee.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Payable now ({quote.currency})</Text>
            <Text style={styles.totalValue}>₹{quote.total_guest_pays.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={styles.payNote}>
            This is all you pay through the app to confirm your request.
          </Text>
        </View>

        {/* Pay the host directly */}
        <View style={styles.card}>
          <View style={styles.eyebrowRow}>
            <View style={styles.accentBar} />
            <Text style={styles.eyebrow}>Pay host directly</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>₹{quote.host_nightly_price.toLocaleString('en-IN')} × {quote.nights} nights (rent)</Text>
            <Text style={styles.priceValue}>₹{quote.subtotal.toLocaleString('en-IN')}</Text>
          </View>
          {withMeals && quote.meal_total !== null && quote.meal_total > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                Meals ({quote.nights} days × ₹{(quote.meal_cost_per_day ?? 0).toLocaleString('en-IN')})
              </Text>
              <Text style={styles.priceValue}>₹{quote.meal_total.toLocaleString('en-IN')}</Text>
            </View>
          )}
          {quote.security_deposit > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Security deposit (refundable)</Text>
              <Text style={styles.priceValue}>₹{quote.security_deposit.toLocaleString('en-IN')}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Payable to host</Text>
            <Text style={styles.totalValue}>₹{quote.pay_to_host_directly.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={styles.payNote}>
            Settle this with the host directly (cash / UPI) at check-in.
          </Text>
        </View>

        {/* Cancellation policy row — tappable */}
        <TouchableOpacity
          style={styles.policyRow}
          onPress={() => setPolicyModalVisible(true)}
          activeOpacity={0.75}
        >
          <View style={[styles.policyBadge, { backgroundColor: policyMeta.color + '18' }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={policyMeta.color} />
            <Text style={[styles.policyBadgeText, { color: policyMeta.color }]}>
              {policyMeta.label} cancellation
            </Text>
          </View>
          <View style={styles.policyRowRight}>
            <Text style={styles.policyRowHint}>See refund details</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSec} />
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* Pay button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, (submitting || genderMismatch) && styles.payBtnDisabled]}
          onPress={handleConfirmAndPay}
          disabled={submitting || genderMismatch}
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

      {/* Cancellation policy modal */}
      <CancellationPolicyModal
        visible={policyModalVisible}
        onClose={() => setPolicyModalVisible(false)}
        policyKey={policyKey}
        COLORS={COLORS}
        styles={styles}
      />
    </View>
  );
}

// ─── Cancellation Policy Modal ───────────────────────────────────────────────

function CancellationPolicyModal({
  visible,
  onClose,
  policyKey,
  COLORS,
  styles,
}: {
  visible: boolean;
  onClose: () => void;
  policyKey: PolicyKey;
  COLORS: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const meta = POLICY_META[policyKey];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Cancellation policy</Text>
              <Text style={styles.modalSubtitle}>{meta.tagline}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Policy badge */}
          <View style={[styles.modalPolicyBadge, { backgroundColor: meta.color + '15', borderColor: meta.color + '30' }]}>
            <Ionicons name="shield-checkmark" size={20} color={meta.color} />
            <Text style={[styles.modalPolicyLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>

          {/* Refund tiers */}
          <Text style={styles.modalSectionLabel}>Refund schedule</Text>
          <View style={styles.tiersContainer}>
            {meta.tiers.map((tier, idx) => (
              <View key={idx} style={styles.tierRow}>
                {/* Timeline dot + line */}
                <View style={styles.tierTimeline}>
                  <View style={[
                    styles.tierDot,
                    { backgroundColor: tier.highlight ? meta.color : COLORS.border }
                  ]} />
                  {idx < meta.tiers.length - 1 && <View style={styles.tierLine} />}
                </View>
                {/* Content */}
                <View style={styles.tierContent}>
                  <Text style={styles.tierWindow}>{tier.window}</Text>
                  <View style={[
                    styles.tierRefundBadge,
                    {
                      backgroundColor: tier.refund === 'No refund'
                        ? '#FEE2E2'
                        : tier.highlight ? '#D1FAE5' : '#FEF3C7'
                    }
                  ]}>
                    <Text style={[
                      styles.tierRefundText,
                      {
                        color: tier.refund === 'No refund'
                          ? '#DC2626'
                          : tier.highlight ? '#065F46' : '#92400E'
                      }
                    ]}>
                      {tier.refund}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.modalSectionLabel}>Important notes</Text>
          <View style={styles.notesContainer}>
            {POLICY_NOTES.map((note, idx) => (
              <View key={idx} style={styles.noteRow}>
                <Ionicons name="information-circle-outline" size={15} color={COLORS.textSec} style={{ marginTop: 1 }} />
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>

          {/* Got it button */}
          <TouchableOpacity style={[styles.modalGotItBtn, { backgroundColor: COLORS.primary }]} onPress={onClose}>
            <Text style={styles.modalGotItText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
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
  headerTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.text, letterSpacing: 1, textTransform: 'uppercase' },

  scroll: { padding: SPACING.md, paddingBottom: 120 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm,
  },

  // Uppercase eyebrow with accent bar
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  accentBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: COLORS.primary },
  eyebrow: { ...FONTS.bold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.text },

  listingTitle: { fontSize: 22, ...FONTS.serif, color: COLORS.text, marginBottom: SPACING.sm },
  cardTitle: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, marginBottom: SPACING.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
  mealTitle: { fontSize: 15, ...FONTS.bold, color: COLORS.text, marginBottom: 2 },
  mealTypes: { fontSize: 13, color: COLORS.textSec, marginBottom: 2 },
  mealCost: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },
  mealDesc: { fontSize: 13, color: COLORS.textSec, marginTop: SPACING.sm, lineHeight: 19 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  label: { fontSize: 14, color: COLORS.textSec, ...FONTS.regular },
  value: { fontSize: 14, color: COLORS.text, ...FONTS.semibold, textAlign: 'right', flexShrink: 1, marginLeft: SPACING.md },
  lastRow: { borderBottomWidth: 0, paddingBottom: 0 },

  // Alert card (gender restriction)
  alertCard: {
    backgroundColor: COLORS.chip, borderWidth: 1, borderColor: COLORS.danger,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  alertTitle: { fontSize: 14, ...FONTS.bold, color: COLORS.danger, marginBottom: 4, letterSpacing: 0.6, textTransform: 'uppercase' },
  alertText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  priceLabel: { fontSize: 14, color: COLORS.textSec, flex: 1 },
  priceValue: { fontSize: 14, color: COLORS.text, ...FONTS.medium },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  totalLabel: { fontSize: 16, color: COLORS.text, ...FONTS.bold },
  totalValue: { fontSize: 16, color: COLORS.text, ...FONTS.bold },
  payNote: { fontSize: 12, color: COLORS.textMut, marginTop: 8, lineHeight: 17 },

  // Policy row (tappable card)
  policyRow: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  policyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill,
  },
  policyBadgeText: { fontSize: 13, ...FONTS.semibold },
  policyRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyRowHint: { fontSize: 13, color: COLORS.textSec },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.md, backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 32,
  },
  payBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingVertical: 16, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    ...SHADOW.sm,
  },
  payBtnDisabled: { backgroundColor: COLORS.primaryLight, opacity: 0.5 },
  payBtnText: { color: '#fff', fontSize: 16, ...FONTS.bold },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  modalTitle: { fontSize: 20, ...FONTS.bold, color: COLORS.text },
  modalSubtitle: { fontSize: 13, color: COLORS.textSec, marginTop: 3, maxWidth: 260 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
  },
  modalPolicyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, marginBottom: SPACING.lg,
  },
  modalPolicyLabel: { fontSize: 15, ...FONTS.bold },

  modalSectionLabel: {
    fontSize: 12, ...FONTS.semibold, color: COLORS.textSec,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },

  // Tiers
  tiersContainer: { marginBottom: SPACING.lg },
  tierRow: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  tierTimeline: { alignItems: 'center', width: 16, paddingTop: 4 },
  tierDot: { width: 12, height: 12, borderRadius: 6 },
  tierLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4, minHeight: 24 },
  tierContent: { flex: 1, paddingBottom: SPACING.md },
  tierWindow: { fontSize: 14, color: COLORS.text, ...FONTS.medium, marginBottom: 6 },
  tierRefundBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill,
  },
  tierRefundText: { fontSize: 13, ...FONTS.semibold },

  // Notes
  notesContainer: { marginBottom: SPACING.lg, gap: 8 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteText: { fontSize: 13, color: COLORS.textSec, flex: 1, lineHeight: 19 },

  modalGotItBtn: {
    paddingVertical: 15, borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modalGotItText: { color: '#fff', fontSize: 16, ...FONTS.bold },
});