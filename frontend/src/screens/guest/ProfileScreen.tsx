import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';

interface Props {
  navigation?: any;
}

export default function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const initial = (user?.first_name?.[0] || user?.display_name?.[0] || 'U').toUpperCase();
  const displayName = user?.display_name || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'User';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {navigation?.canGoBack?.() && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {user?.city ? <Text style={styles.city}>{user.city}</Text> : null}
        </View>

        {/* Verification badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
            <Ionicons name="call-outline" size={14} color="#10B981" />
            <Text style={[styles.badgeText, { color: '#10B981' }]}>Phone verified</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Manage your profile, verification, and payment settings from the menu on the home screen.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, ...FONTS.semibold, color: COLORS.text },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xl },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  avatarImg: { width: 80, height: 80 },
  avatarInitial: { fontSize: 32, color: '#fff', ...FONTS.bold },
  name: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  city: { fontSize: 14, color: COLORS.textSec },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.xl, justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  badgeText: { fontSize: 12, ...FONTS.semibold },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: SPACING.md,
    backgroundColor: COLORS.primaryAlpha,
    borderRadius: RADIUS.md,
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 19 },
});
