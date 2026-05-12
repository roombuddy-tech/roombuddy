import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import PhoneInput from '../../components/forms/PhoneInput';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import Button from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../utils/errors';
import { isValidIndianPhone } from '../../utils/validators';



type Props = NativeStackScreenProps<any, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);


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
      await authService.sendOTP(phone, '+91', 'login');
      navigation.navigate('OTP', { phoneNumber: phone });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'ACCOUNT_NOT_FOUND') {
        setAccountNotFound(true);
      } else {
        Alert.alert('Error', getErrorMessage(err, 'Failed to send OTP. Please try again.'));
      }
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
              onChangeText={(text) => { setPhone(text); setError(''); setAccountNotFound(false); }}
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

            {accountNotFound && (
              <View style={styles.notFoundBox}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
                <Text style={styles.notFoundText}>
                  No account found with this number.{' '}
                  <Text
                    style={styles.signUpLink}
                    onPress={async () => {
                      setAccountNotFound(false);
                      setLoading(true);
                      try {
                        await authService.sendOTP(phone, '+91', 'signup');
                        navigation.navigate('OTP', { phoneNumber: phone });
                      } catch (err: any) {
                        Alert.alert('Error', getErrorMessage(err, 'Failed to send OTP.'));
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Sign up instead
                  </Text>
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://roombuddy.co.in/terms')}>
            Terms of Service
          </Text>{' '}and{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://roombuddy.co.in/privacy')}>
            Privacy Policy
          </Text>
        </Text>
        
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
    textDecorationLine: 'underline'
  },
notFoundBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.warm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FFE0D6',
  },
  notFoundText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSec,
    ...FONTS.medium,
    lineHeight: 21,
  },
  signUpLink: {
    color: COLORS.accent,
    ...FONTS.bold,
  },
});