import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SHADOW, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';
import type { GuestStackParamList } from '../../navigation/types';
import api from '../../services/api';
import { cancelBooking } from '../../services/bookings';
import { startConversation } from '../../services/chat';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

interface GuestBooking {
  booking_id: string;
  booking_code: string;
  listing_id: string | null;
  listing_title: string | null;
  area_name: string | null;
  city: string | null;
  cover_photo_url: string | null;
  host_name: string;
  host_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  rental_type?: 'monthly' | 'nightly';
  recurring_monthly?: number | null;
  status: string;
  payment_status: string;
  total_guest_pays: number;
  cancellation_policy: string | null;
  created_at: string;
  can_review?: boolean;
  has_reviewed?: boolean;
}

// ─── Cancellation policy config (RoomBuddy decides — platform-wide moderate) ──

const PLATFORM_POLICY = 'flexible';

const POLICY_META = {
  flexible: {
    label: 'Free cancellation', color: '#B85C38',
  },
} as const;

type PolicyKey = keyof typeof POLICY_META;

const POLICY_NOTES = [
  'You can cancel anytime before check-in.',
  'The ₹49 booking fee is non-refundable.',
  'Rent, security deposit and meals are paid to the host at check-in — nothing is collected in advance.',
  'If you cancel before check-in, you are not charged anything beyond the ₹49 booking fee.',
];

// ─── Status config ────────────────────────────────────────────────────────────

const makeStatusConfig = (COLORS: ThemeColors) => ({
  pending:           { label: 'Pending confirmation', color: '#B45309', bg: '#FEF3C7', icon: 'time-outline' },
  accepted:          { label: 'Confirmed', color: '#047857', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  active:            { label: 'Active stay', color: COLORS.primary, bg: COLORS.primaryAlpha, icon: 'home-outline' },
  completed:         { label: 'Completed', color: COLORS.textSec, bg: COLORS.surface, icon: 'checkmark-done-outline' },
  rejected:          { label: 'Rejected by host', color: COLORS.danger, bg: '#FEE2E2', icon: 'close-circle-outline' },
  cancelled_by_guest:{ label: 'Cancelled', color: COLORS.textMut, bg: COLORS.surface, icon: 'close-outline' },
  cancelled_by_host: { label: 'Cancelled by host', color: COLORS.danger, bg: '#FEE2E2', icon: 'close-outline' },
  expired:           { label: 'Expired', color: COLORS.textMut, bg: COLORS.surface, icon: 'alert-circle-outline' },
  no_show:           { label: 'No show', color: COLORS.textMut, bg: COLORS.surface, icon: 'alert-outline' },
} as Record<string, { label: string; color: string; bg: string; icon: string }>);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const CANCELLABLE_STATUSES = ['pending', 'accepted', 'active'];

// ─── Cancellation policy modal ────────────────────────────────────────────────

function CancellationPolicyModal({
  visible,
  onClose,
  COLORS,
  styles,
}: {
  visible: boolean;
  onClose: () => void;
  COLORS: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const meta = POLICY_META[PLATFORM_POLICY];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Cancellation policy</Text>
              <Text style={styles.modalSub}>Platform-wide policy set by RoomBuddy</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.modalBadge, { backgroundColor: meta.color + '15', borderColor: meta.color + '30' }]}>
            <Ionicons name="shield-checkmark" size={18} color={meta.color} />
            <Text style={[styles.modalBadgeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>

          <View style={styles.freeCancelCard}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
            <Text style={styles.freeCancelText}>
              Cancel any time before check-in at no charge. You only pay the ₹49 booking fee, which is non-refundable.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Notes</Text>
          <View style={{ gap: 8, marginBottom: SPACING.lg }}>
            {POLICY_NOTES.map((note, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8 }}>
                <Ionicons name="information-circle-outline" size={15} color={COLORS.textSec} style={{ marginTop: 1 }} />
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.gotItBtn, { backgroundColor: COLORS.primary }]} onPress={onClose}>
            <Text style={styles.gotItText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cancel confirmation modal ────────────────────────────────────────────────

function CancelConfirmModal({
  visible,
  booking,
  onClose,
  onConfirm,
  cancelling,
  COLORS,
  styles,
}: {
  visible: boolean;
  booking: GuestBooking | null;
  onClose: () => void;
  onConfirm: () => void;
  cancelling: boolean;
  COLORS: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (!booking) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
            <View style={[styles.cancelIconWrap, { backgroundColor: COLORS.primaryAlpha }]}>
              <Ionicons name="information-circle" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Cancel this booking?</Text>
            <Text style={styles.modalSub}>{booking.listing_title ?? 'Your stay'}</Text>
          </View>

          {/* Free cancellation info */}
          <View style={styles.cancelInfoCard}>
            <Text style={styles.cancelInfoTitle}>Free cancellation</Text>
            <Text style={styles.cancelInfoText}>
              You only lose the ₹49 booking fee, which is non-refundable. Rent, deposit and meals are paid to the host at check-in — so there is nothing else to pay.
            </Text>
          </View>

          <View style={styles.cancelActions}>
            <TouchableOpacity style={styles.keepBtn} onPress={onClose} disabled={cancelling}>
              <Text style={styles.keepBtnText}>Keep booking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmCancelBtn, cancelling && { opacity: 0.6 }]}
              onPress={onConfirm}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.confirmCancelText}>Yes, cancel</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MyStaysScreen() {
  const navigation = useNavigation<Nav>();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const STATUS_CONFIG = useMemo(() => makeStatusConfig(COLORS), [COLORS]);

  const [bookings, setBookings] = useState<GuestBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<GuestBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.GUEST.BOOKINGS);
      setBookings(res.data.results ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); fetchBookings(); }, [fetchBookings]));

  const onRefresh = () => { setRefreshing(true); fetchBookings(); };

  const callHost = (phone: string) => Linking.openURL(`tel:${phone}`);

  const messageHost = async (b: GuestBooking) => {
    try {
      const convo = await startConversation(b.booking_id);
      const chatOff = ['cancelled_by_guest', 'cancelled_by_host', 'rejected', 'expired'].includes(b.status);
      navigation.navigate('Chat', {
        conversationId: convo.conversation_id,
        title: b.host_name,
        subtitle: convo.listing_title ?? undefined,
        chatDisabled: chatOff,
        listingId: convo.listing_id ?? undefined,
      });
    } catch {}
  };

  const handleCancelPress = (b: GuestBooking) => setCancelTarget(b);

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelBooking(cancelTarget.booking_id, '');
      setCancelTarget(null);
      // Refresh list
      const res = await api.get(ENDPOINTS.GUEST.BOOKINGS);
      setBookings(res.data.results ?? []);
      Alert.alert('Booking cancelled', 'Your booking has been cancelled. Refund (if applicable) will be processed within 5–10 business days.');
    } catch {
      Alert.alert('Error', 'Could not cancel booking. Please try again or contact support.');
    } finally {
      setCancelling(false);
    }
  };

  const renderBooking = ({ item }: { item: GuestBooking }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
    const canContact = item.status === 'accepted' || item.status === 'active';
    const canCancel = CANCELLABLE_STATUSES.includes(item.status);
    const policyKey: PolicyKey = 'flexible';
    const policyMeta = POLICY_META[policyKey];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => { if (item.listing_id) navigation.navigate('GuestListingDetail', { listingId: item.listing_id }); }}
      >
        <View style={styles.imageWrap}>
          <Image
            source={item.cover_photo_url ? { uri: item.cover_photo_url } : require('../../../assets/icon.png')}
            style={styles.cardImg}
            resizeMode="cover"
          />
          <View style={styles.statusOverlay}>
            <View style={[styles.statusOverlayDot, { backgroundColor: cfg.color }]} />
            <Text style={styles.statusOverlayTxt}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.listing_title ?? 'Untitled listing'}</Text>
          <View style={styles.cardSub}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMut} />
            <Text style={styles.cardSubText} numberOfLines={1}>{[item.area_name, item.city].filter(Boolean).join(', ')}</Text>
          </View>

          <View style={styles.datesRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSec} />
            {item.rental_type === 'monthly' ? (
              <>
                <Text style={styles.datesText}>{fmtDateShort(item.check_in_date)} – {fmtDateShort(item.check_out_date)}</Text>
                <Text style={styles.nightsText}>Monthly</Text>
              </>
            ) : (
              <>
                <Text style={styles.datesText}>{fmtDateShort(item.check_in_date)} – {fmtDateShort(item.check_out_date)}</Text>
                <Text style={styles.nightsText}>{item.nights} night{item.nights !== 1 ? 's' : ''}</Text>
              </>
            )}
          </View>

          {/* Cancellation policy pill — tappable */}
          {canCancel && (
            <TouchableOpacity
              style={[styles.policyPill, { backgroundColor: policyMeta.color + '12' }]}
              onPress={() => setPolicyModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark-outline" size={13} color={policyMeta.color} />
              <Text style={[styles.policyPillText, { color: policyMeta.color }]}>
                {policyMeta.label} before check-in
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.cardFooter}>
            {item.rental_type === 'monthly' && item.recurring_monthly ? (
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>Monthly rent to host</Text>
                <Text style={styles.payValue}>
                  ₹{Math.round(item.recurring_monthly).toLocaleString('en-IN')}<Text style={styles.payUnit}>/mo</Text>
                </Text>
              </View>
            ) : null}

            <View style={styles.payRow}>
              <Text style={styles.payLabel}>
                {item.rental_type === 'monthly' ? 'Booking fee paid' : 'Total paid'}
              </Text>
              <Text style={styles.payValue}>₹{Math.round(item.total_guest_pays).toLocaleString('en-IN')}</Text>
            </View>

            <View style={styles.footerActions}>
              <TouchableOpacity style={styles.msgBtn} onPress={() => messageHost(item)} activeOpacity={0.7}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} />
                <Text style={styles.msgBtnTxt}>Message</Text>
              </TouchableOpacity>

              {canContact && item.host_phone && (
                <TouchableOpacity style={styles.contactBtn} onPress={() => callHost(item.host_phone!)} activeOpacity={0.7}>
                  <Ionicons name="call-outline" size={16} color="#fff" />
                  <Text style={styles.contactBtnTxt}>Call</Text>
                </TouchableOpacity>
              )}

              {item.can_review && !item.has_reviewed && (
                <TouchableOpacity
                  style={styles.reviewBtn}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('WriteReview', {
                    bookingId: item.booking_id,
                    listingTitle: item.listing_title ?? 'Your stay',
                    hostName: item.host_name,
                  })}
                >
                  <Ionicons name="star-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.reviewBtnTxt}>Leave a review</Text>
                </TouchableOpacity>
              )}
              {item.has_reviewed && (
                <View style={styles.reviewedBadge}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.reviewedTxt}>Reviewed</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardBottomRow}>
            <Text style={styles.hostName}>Hosted by {item.host_name}</Text>
            {canCancel && (
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => handleCancelPress(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelLinkText}>Cancel booking</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}><Text style={styles.headerTitle}>My Stays</Text></View>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  if (bookings.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}><Text style={styles.headerTitle}>My Stays</Text></View>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIllustration}>
            <View style={styles.emptyHouse}><Ionicons name="home" size={40} color={COLORS.primary} /></View>
            <View style={styles.emptyCalendar}><Ionicons name="calendar" size={24} color={COLORS.primary} /></View>
            <View style={styles.emptyHeart}><Ionicons name="bed" size={20} color={COLORS.star} /></View>
          </View>
          <Text style={styles.emptyTitle}>No stays yet</Text>
          <Text style={styles.emptySub}>Your bookings will appear here once you{'\n'}find the perfect room</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            activeOpacity={0.85}
            onPress={() => navigation.getParent()?.navigate('GuestTabs', { screen: 'Home', params: { openSearch: true } })}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.emptyBtnTxt}>Find a room</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Stays</Text>
      </View>
      <FlatList
        data={bookings}
        keyExtractor={(b) => b.booking_id}
        renderItem={renderBooking}
        contentContainerStyle={styles.listPad}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      />

      <CancellationPolicyModal
        visible={policyModalVisible}
        onClose={() => setPolicyModalVisible(false)}
        COLORS={COLORS}
        styles={styles}
      />

      <CancelConfirmModal
        visible={!!cancelTarget}
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        cancelling={cancelling}
        COLORS={COLORS}
        styles={styles}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.lg, backgroundColor: COLORS.bg },
  headerTitle: { fontSize: 30, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5 },
  listPad: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, paddingBottom: SPACING.xxl },

  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, marginBottom: SPACING.lg, overflow: 'hidden', ...SHADOW.md },
  imageWrap: { position: 'relative' },
  cardImg: { width: '100%', height: 180, backgroundColor: COLORS.chip },
  statusOverlay: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(20,18,16,0.62)', borderRadius: RADIUS.pill,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  statusOverlayDot: { width: 6, height: 6, borderRadius: 3 },
  statusOverlayTxt: { fontSize: 12, ...FONTS.semibold, color: '#fff' },
  cardBody: { padding: SPACING.lg },
  cardTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: 6, lineHeight: 24 },
  cardSub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: SPACING.sm },
  cardSubText: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium, flex: 1 },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  datesText: { fontSize: 13, color: COLORS.text, ...FONTS.medium },
  nightsText: { fontSize: 12, color: COLORS.textMut, marginLeft: 4, ...FONTS.medium },

  // Policy pill
  policyPill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.md, marginBottom: SPACING.sm },
  policyPillText: { fontSize: 12, ...FONTS.semibold, flex: 1, lineHeight: 17 },

  cardFooter: { gap: SPACING.xs, marginBottom: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACING.sm },
  payLabel: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium, flexShrink: 1 },
  payValue: { fontSize: 16, color: COLORS.text, ...FONTS.semibold },
  payUnit: { fontSize: 12, color: COLORS.textSec, ...FONTS.medium },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: SPACING.sm },

  msgBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: COLORS.surface },
  msgBtnTxt: { color: COLORS.primary, fontSize: 13, ...FONTS.semibold },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 10 },
  contactBtnTxt: { color: '#fff', fontSize: 13, ...FONTS.semibold },

  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hostName: { fontSize: 12, color: COLORS.textMut, ...FONTS.medium },
  cancelLink: { paddingVertical: 4, paddingHorizontal: 2 },
  cancelLinkText: { fontSize: 13, color: COLORS.danger, ...FONTS.medium, textDecorationLine: 'underline' },

  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  reviewBtnTxt: { color: COLORS.primary, fontSize: 13, ...FONTS.semibold },
  reviewedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.sm, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  reviewedTxt: { fontSize: 13, color: '#B45309', ...FONTS.semibold },

  // Empty state
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl },
  emptyIllustration: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg },
  emptyHouse: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  emptyCalendar: { position: 'absolute', top: 4, right: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.bg },
  emptyHeart: { position: 'absolute', bottom: 12, left: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.chip, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.bg },
  emptyTitle: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.sm },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnTxt: { color: '#fff', fontSize: 16, ...FONTS.bold },

  // Modal shared
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  modalTitle: { fontSize: 20, ...FONTS.bold, color: COLORS.text, textAlign: 'center' },
  modalSub: { fontSize: 13, color: COLORS.textSec, marginTop: 3, textAlign: 'center' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  modalBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg },
  modalBadgeLabel: { fontSize: 15, ...FONTS.bold },
  sectionLabel: { fontSize: 12, ...FONTS.semibold, color: COLORS.textSec, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SPACING.sm },
  noteText: { fontSize: 13, color: COLORS.textSec, flex: 1, lineHeight: 19 },
  gotItBtn: { paddingVertical: 15, borderRadius: RADIUS.md, alignItems: 'center' },
  gotItText: { color: '#fff', fontSize: 16, ...FONTS.bold },

  // Policy tier
  tierRow: { flexDirection: 'row', gap: 12 },
  tierTimeline: { alignItems: 'center', width: 16, paddingTop: 4 },
  tierDot: { width: 12, height: 12, borderRadius: 6 },
  tierLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4, minHeight: 24 },
  tierContent: { flex: 1, paddingBottom: SPACING.md },
  tierWindow: { fontSize: 14, color: COLORS.text, ...FONTS.medium, marginBottom: 6 },
  tierBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  tierRefund: { fontSize: 13, ...FONTS.semibold },

  // Cancel modal
  cancelIconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  cancelInfoCard: { backgroundColor: COLORS.primaryAlpha, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  cancelInfoTitle: { fontSize: 14, ...FONTS.bold, color: COLORS.primary, marginBottom: 4 },
  cancelInfoText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  freeCancelCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.primaryAlpha, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  freeCancelText: { flex: 1, fontSize: 14, color: COLORS.text, ...FONTS.medium, lineHeight: 21 },
  cancelActions: { flexDirection: 'row', gap: SPACING.sm },
  keepBtn: { flex: 1, paddingVertical: 15, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  keepBtnText: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  confirmCancelBtn: { flex: 1, paddingVertical: 15, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.danger },
  confirmCancelText: { fontSize: 15, ...FONTS.bold, color: '#fff' },
});
