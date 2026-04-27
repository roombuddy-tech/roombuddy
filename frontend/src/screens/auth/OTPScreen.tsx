import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import OTPInput from '../../components/forms/OTPInput';
import Button from '../../components/ui/Button';
import { authService } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'OTP'>;

export default function OTPScreen({ navigation, route }: Props) {
  const { phoneNumber } = route.params as { phoneNumber: string };
  const { login } = useAuth();

  const [otpValue, setOtpValue] = useState('');
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
    if (otpCode.length < 6) return;
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

  const maskedPhone = `+91 ${phoneNumber.slice(0, 5)} XXXXX`;

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          <Text style={styles.backText}>Edit number</Text>
        </TouchableOpacity>

        {/* Brand */}
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Room<Text style={styles.brandAccent}>Buddy</Text></Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to <Text style={styles.phone}>{maskedPhone}</Text>
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.changeNumber}>Wrong number? Change it</Text>
          </TouchableOpacity>
        </View>

        {/* OTP Input */}
        <View style={styles.otpSection}>
          <OTPInput onComplete={(code) => { setOtpValue(code); handleVerify(code); }} />
        </View>

        {/* Verify button */}
        <Button
          title="Verify"
          onPress={() => handleVerify(otpValue)}
          variant="primary"
          size="lg"
          loading={loading}
          disabled={otpValue.length < 6}
          full
        />

        {/* Resend */}
        <View style={styles.resendSection}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendText}>
                Didn't receive? <Text style={styles.resendActive}>Resend OTP</Text>
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendText}>
              Didn't receive? <Text style={styles.resendActive}>Resend in {countdown}s</Text>
            </Text>
          )}
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: SPACING.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.lg },
  backText: { fontSize: 15, color: COLORS.text, ...FONTS.medium },
  brandRow: { alignItems: 'flex-start', marginBottom: SPACING.xxl },
  brand: { fontSize: 24, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  title: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 22 },
  phone: { color: COLORS.text, ...FONTS.semibold },
  changeNumber: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold, marginTop: SPACING.sm },
  otpSection: { marginBottom: SPACING.xl },
  resendSection: { alignItems: 'center', marginTop: SPACING.lg },
  resendText: { fontSize: 14, color: COLORS.textMut },
  resendActive: { color: COLORS.primary, ...FONTS.semibold },
});