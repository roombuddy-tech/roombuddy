import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import OTPInput from '../../components/forms/OTPInput';
import Button from '../../components/ui/Button';
import { authService } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'OTP'>;

export default function OTPScreen({ navigation, route }: Props) {
  const { phoneNumber } = route.params as { phoneNumber: string };
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async (otpCode: string) => {
    setLoading(true);
    try {
      const response = await authService.verifyOTP(phoneNumber, otpCode);

      await login(response.tokens, {
        phone_number: phoneNumber,
        is_new_user: response.is_new_user,
        is_profile_complete: response.is_profile_complete,
      });

      if (!response.is_profile_complete) {
        navigation.replace('ProfileSetup');
      }
      // If profile complete, AuthContext triggers GuestTabs
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Verification failed. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authService.sendOTP(phoneNumber);
      setCountdown(30);
      setCanResend(false);
      Alert.alert('OTP Sent', 'A new OTP has been sent to your phone.');
    } catch {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    }
  };

  const maskedPhone = `+91 ${phoneNumber.slice(0, 2)}****${phoneNumber.slice(-2)}`;

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{maskedPhone}</Text>
          </Text>
        </View>

        <View style={styles.otpSection}>
          <OTPInput onComplete={handleVerify} />
        </View>

        {loading && (
          <Button title="Verifying..." variant="primary" size="lg" loading full onPress={() => {}} />
        )}

        <View style={styles.resendSection}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendActive}>Resend OTP</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendTimer}>
              Resend OTP in <Text style={styles.timerCount}>{countdown}s</Text>
            </Text>
          )}
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  back: {
    marginBottom: SPACING.xl,
  },
  backText: {
    fontSize: 15,
    color: COLORS.primary,
    ...FONTS.semibold,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    fontSize: 26,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSec,
    textAlign: 'center',
    lineHeight: 22,
  },
  phone: {
    color: COLORS.text,
    ...FONTS.semibold,
  },
  otpSection: {
    marginBottom: SPACING.xl,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  resendTimer: {
    fontSize: 14,
    color: COLORS.textMut,
  },
  timerCount: {
    color: COLORS.primary,
    ...FONTS.semibold,
  },
  resendActive: {
    fontSize: 15,
    color: COLORS.primary,
    ...FONTS.semibold,
  },
  helpSection: {
    marginTop: SPACING.xxl,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.md,
    backgroundColor: COLORS.warm,
    borderRadius: RADIUS.md,
  },
  helpIcon: {
    fontSize: 16,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.accent,
    lineHeight: 18,
  },
});