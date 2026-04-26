import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🏠</Text>
        <Text style={styles.brand}>
          Room<Text style={styles.brandAccent}>Buddy</Text>
        </Text>
        <Text style={styles.subtitle}>
          Affordable short-term stays in shared homes.{'\n'}Book a room, not a hotel.
        </Text>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.getStartedBtn} onPress={() => navigation.replace('Login')}>
          <Text style={styles.getStartedText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.loginRow}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  icon: {
    fontSize: 72,
    marginBottom: SPACING.lg,
  },
  brand: {
    fontSize: 42,
    ...FONTS.extrabold,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: SPACING.md,
  },
  brandAccent: {
    color: COLORS.accent,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: 0,
    paddingBottom: SPACING.xxl,
  },
  getStartedBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    alignItems: 'center',
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 18,
    ...FONTS.bold,
  },
  loginRow: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },
  loginText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  loginLink: {
    color: 'rgba(255,255,255,0.8)',
    textDecorationLine: 'underline',
    ...FONTS.medium,
  },
});