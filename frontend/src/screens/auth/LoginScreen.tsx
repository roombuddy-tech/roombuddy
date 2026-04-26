import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import PhoneInput from '../../components/forms/PhoneInput';
import Button from '../../components/ui/Button';
import { authService } from '../../services/auth';
import { isValidIndianPhone } from '../../utils/validators';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }
    if (!isValidIndianPhone(phone)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await authService.sendOTP(phone);
      navigation.navigate('OTP', { phoneNumber: phone });
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>
            Room<Text style={styles.brandAccent}>Buddy</Text>
          </Text>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          <Text style={styles.title}>Welcome to RoomBuddy</Text>
          <Text style={styles.subtitle}>Enter your phone number to continue</Text>

          <View style={styles.form}>
            <PhoneInput
              value={phone}
              onChangeText={(text) => { setPhone(text); setError(''); }}
              error={error}
              autoFocus
            />

            <Button
              title="Send OTP"
              onPress={handleSendOTP}
              variant="primary"
              size="lg"
              loading={loading}
              disabled={phone.length < 10}
              full
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.secureRow}>
            <Text style={styles.secureIcon}>🔒</Text>
            <Text style={styles.secureText}>
              Your number is encrypted and never shared with hosts or guests
            </Text>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: SPACING.xxl,
  },
  brand: {
    fontSize: 24,
    ...FONTS.extrabold,
    color: COLORS.primaryDark,
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: COLORS.accent,
  },
  main: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    ...FONTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSec,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  form: {
    gap: SPACING.lg,
  },
  footer: {
    marginTop: SPACING.xl,
  },
  terms: {
    fontSize: 13,
    color: COLORS.textMut,
    textAlign: 'center',
    lineHeight: 20,
  },
  link: {
    color: COLORS.primary,
    ...FONTS.medium,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  secureIcon: {
    fontSize: 16,
  },
  secureText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMut,
    lineHeight: 18,
  },
});