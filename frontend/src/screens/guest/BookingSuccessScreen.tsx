import { Ionicons } from '@expo/vector-icons';
import { CommonActions, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import type { GuestStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<GuestStackParamList, 'BookingSuccess'>;
type Rt = RouteProp<GuestStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { bookingCode } = route.params;

  function goHome() {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'GuestTabs' }] }),
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={56} color="#fff" />
        </View>
        <Text style={styles.title}>Booking confirmed!</Text>
        <Text style={styles.subtitle}>Your stay is booked and payment is successful.</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Booking code</Text>
          <Text style={styles.code}>{bookingCode}</Text>
        </View>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            We've sent a confirmation to your email. Your host will reach out shortly with check-in details.
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={goHome}>
          <Text style={styles.primaryText}>View my bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
          <Text style={styles.secondaryText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 80 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.lg },
  checkCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  title: { fontSize: 26, ...FONTS.bold, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: COLORS.textSec, marginBottom: SPACING.xl, textAlign: 'center' },
  codeBox: {
    backgroundColor: COLORS.surface, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md, alignItems: 'center', marginBottom: SPACING.lg,
  },
  codeLabel: { fontSize: 12, color: COLORS.textMut, ...FONTS.medium, marginBottom: 4, textTransform: 'uppercase' },
  code: { fontSize: 22, ...FONTS.bold, color: COLORS.primary, letterSpacing: 1 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.primaryAlpha, padding: SPACING.md,
    borderRadius: RADIUS.md, marginTop: SPACING.md, gap: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
  footer: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: 32 },
  primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, ...FONTS.bold },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: COLORS.primary, fontSize: 15, ...FONTS.semibold },
});