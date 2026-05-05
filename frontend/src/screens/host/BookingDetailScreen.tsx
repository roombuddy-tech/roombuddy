import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import type { HostStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<HostStackParamList, 'BookingDetail'>;
type Route = RouteProp<HostStackParamList, 'BookingDetail'>;

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  active: { text: '#0D7377', bg: '#E6F5F0' },
  accepted: { text: '#0D7377', bg: '#E6F5F0' },
  pending: { text: '#B8860B', bg: '#FFF8E6' },
  completed: { text: '#5F7285', bg: '#F7F9FA' },
  cancelled_by_guest: { text: '#EF4444', bg: '#FFF0F0' },
  cancelled_by_host: { text: '#EF4444', bg: '#FFF0F0' },
  rejected: { text: '#EF4444', bg: '#FFF0F0' },
  expired: { text: '#94A3B8', bg: '#F7F9FA' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { booking } = route.params;

  const statusStyle = STATUS_COLORS[booking.status] || STATUS_COLORS.pending;

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
              {formatStatus(booking.status)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stay details</Text>
          <DetailRow label="Booking code" value={booking.booking_code} />
          <DetailRow label="Check-in" value={formatDate(booking.check_in_date)} />
          <DetailRow label="Check-out" value={formatDate(booking.check_out_date)} />
          <DetailRow label="Nights" value={`${booking.nights} night${booking.nights > 1 ? 's' : ''}`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <DetailRow
            label="Guest pays"
            value={`₹${booking.total_guest_pays.toLocaleString('en-IN')}`}
          />
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>You receive</Text>
            <Text style={styles.earningsValue}>
              ₹{booking.total_host_receives.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {booking.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]}>
              <Text style={styles.rejectTxt}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]}>
              <Text style={styles.acceptTxt}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});
