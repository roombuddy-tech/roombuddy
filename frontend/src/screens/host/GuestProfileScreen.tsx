/**
 * GuestProfileScreen — public profile of a user.
 *
 * Despite the name, this is a generic public profile screen — it shows the
 * "host viewing guest" angle today, but the same screen is reused for "guest
 * viewing host" later. The backend gates contact-info visibility based on
 * booking relationship, so the same data shape works for both directions.
 *
 * Reached from:
 * - BookingDetail screen → tap on guest card
 *
 * Backend: GET /api/users/<user_id>/public-profile/
 */
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
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

type Nav = NativeStackNavigationProp<HostStackParamList, 'GuestProfile'>;
type Rt = RouteProp<HostStackParamList, 'GuestProfile'>;

interface PublicProfile {
  user_id: string;
  display_name: string;
  initials: string;
  profile_photo_url: string | null;
  city: string | null;
  member_since: string | null;
  verifications: {
    phone_verified: boolean;
    email_verified: boolean;
    id_verified: boolean;
  };
  stats: {
    stays_as_guest: number;
    stays_as_host: number;
    review_count: number;
    average_rating: number | null;
  };
  recent_reviews: Array<{
    rating: number;
    body: string;
    submitted_at: string;
    reviewer_name: string;
    reviewer_initials: string;
  }>;
  contact: { phone: string | null; email: string | null } | null;
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function GuestProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { userId } = route.params;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/users/${userId}/public-profile/`);
        if (!cancelled) setProfile(res.data);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load profile'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={56} color={COLORS.danger} />
        <Text style={styles.errorText}>{error || 'Profile not available'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const verifiedCount =
    Number(profile.verifications.phone_verified) +
    Number(profile.verifications.email_verified) +
    Number(profile.verifications.id_verified);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — photo + name */}
        <View style={styles.heroCard}>
          {profile.profile_photo_url ? (
            <Image source={{ uri: profile.profile_photo_url }} style={styles.avatarLarge} />
          ) : (
            <View style={[styles.avatarLarge, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{profile.initials}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{profile.display_name}</Text>
          {profile.city && (
            <View style={styles.cityRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSec} />
              <Text style={styles.cityText}>{profile.city}</Text>
            </View>
          )}
          {profile.member_since && (
            <Text style={styles.memberSince}>Member since {profile.member_since}</Text>
          )}
        </View>

        {/* Quick stats */}
        <View style={styles.statsCard}>
          <StatItem
            value={String(profile.stats.stays_as_guest)}
            label={profile.stats.stays_as_guest === 1 ? 'Stay' : 'Stays'}
          />
          <View style={styles.statDivider} />
          <StatItem
            value={
              profile.stats.average_rating !== null
                ? profile.stats.average_rating.toFixed(1)
                : '—'
            }
            label="Rating"
          />
          <View style={styles.statDivider} />
          <StatItem
            value={String(profile.stats.review_count)}
            label={profile.stats.review_count === 1 ? 'Review' : 'Reviews'}
          />
        </View>

        {/* Verifications */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verifications</Text>
          <Text style={styles.verifiedSummary}>
            {verifiedCount} of 3 verified
          </Text>
          <VerifyRow
            label="Phone number"
            verified={profile.verifications.phone_verified}
          />
          <VerifyRow
            label="Email address"
            verified={profile.verifications.email_verified}
          />
          <VerifyRow
            label="Government ID"
            verified={profile.verifications.id_verified}
          />
        </View>

        {/* Contact (only when booking relationship exists) */}
        {profile.contact && (profile.contact.phone || profile.contact.email) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact</Text>
            {profile.contact.phone && (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL(`tel:${profile.contact!.phone}`)}
              >
                <Ionicons name="call-outline" size={20} color={COLORS.primary} />
                <Text style={styles.contactText}>{profile.contact.phone}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
              </TouchableOpacity>
            )}
            {profile.contact.email && (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL(`mailto:${profile.contact!.email}`)}
              >
                <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
                <Text style={styles.contactText}>{profile.contact.email}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
              </TouchableOpacity>
            )}
            <Text style={styles.contactNote}>
              Visible because of a confirmed booking with you.
            </Text>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            What hosts say
            {profile.stats.review_count > 0 && ` (${profile.stats.review_count})`}
          </Text>
          {profile.recent_reviews.length === 0 ? (
            <Text style={styles.emptyReviews}>
              No reviews yet — this is one of {profile.display_name.split(' ')[0]}'s first stays.
            </Text>
          ) : (
            profile.recent_reviews.map((r, i) => (
              <View key={i} style={styles.reviewRow}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerAvatar}>
                    <Text style={styles.reviewerInitials}>{r.reviewer_initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
                    <Text style={styles.reviewMeta}>
                      {'★'.repeat(r.rating)}
                      <Text style={{ color: COLORS.textMut }}>
                        {' · '}{formatReviewDate(r.submitted_at)}
                      </Text>
                    </Text>
                  </View>
                </View>
                {r.body ? (
                  <Text style={styles.reviewBody}>{r.body}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function VerifyRow({ label, verified }: { label: string; verified: boolean }) {
  return (
    <View style={styles.verifyRow}>
      <Text style={styles.verifyLabel}>{label}</Text>
      {verified ? (
        <View style={styles.verifyBadge}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
          <Text style={styles.verifyBadgeText}>Verified</Text>
        </View>
      ) : (
        <Text style={styles.verifyMissing}>Not verified</Text>
      )}
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

  scroll: { padding: SPACING.md },

  heroCard: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.lg,
    alignItems: 'center', marginBottom: SPACING.md, ...SHADOW.sm,
  },
  avatarLarge: {
    width: 96, height: 96, borderRadius: 48,
    marginBottom: SPACING.md,
  },
  avatarFallback: {
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarFallbackText: { fontSize: 32, ...FONTS.bold, color: COLORS.primary },
  displayName: { fontSize: 22, ...FONTS.bold, color: COLORS.text },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cityText: { fontSize: 14, color: COLORS.textSec },
  memberSince: { fontSize: 12, color: COLORS.textMut, marginTop: 6, ...FONTS.medium },

  statsCard: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    flexDirection: 'row', alignItems: 'center',
    ...SHADOW.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, ...FONTS.bold, color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textSec, marginTop: 2, ...FONTS.medium },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.border },

  card: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm,
  },
  cardTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, marginBottom: SPACING.md },

  verifiedSummary: { fontSize: 13, color: COLORS.textSec, marginBottom: SPACING.sm },
  verifyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  verifyLabel: { fontSize: 14, color: COLORS.text },
  verifyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifyBadgeText: { fontSize: 13, color: COLORS.success, ...FONTS.medium },
  verifyMissing: { fontSize: 13, color: COLORS.textMut, ...FONTS.medium },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  contactText: { flex: 1, fontSize: 14, color: COLORS.text, ...FONTS.medium },
  contactNote: { fontSize: 11, color: COLORS.textMut, marginTop: SPACING.sm, fontStyle: 'italic' },

  emptyReviews: { fontSize: 13, color: COLORS.textSec, lineHeight: 18 },
  reviewRow: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 6 },
  reviewerAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center', alignItems: 'center',
  },
  reviewerInitials: { fontSize: 12, ...FONTS.bold, color: COLORS.primary },
  reviewerName: { fontSize: 13, ...FONTS.semibold, color: COLORS.text },
  reviewMeta: { fontSize: 12, color: COLORS.accent, marginTop: 2 },
  reviewBody: { fontSize: 13, color: COLORS.text, lineHeight: 19, marginTop: 4 },
});
