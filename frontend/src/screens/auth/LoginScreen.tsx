import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import PhoneInput from '../../components/forms/PhoneInput';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import Button from '../../components/ui/Button';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../utils/errors';
import { isValidIndianPhone } from '../../utils/validators';

type Props = NativeStackScreenProps<any, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);

  const handleContinue = async () => {
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
      // Try auto mode first — works for existing users
      await authService.sendOTP(phone, '+91', 'login');
      navigation.navigate('OTP', { phoneNumber: phone, isSignup: false });
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

  const handleSignUp = async () => {
    setAccountNotFound(false);
    setLoading(true);
    try {
      await authService.sendOTP(phone, '+91', 'signup');
      navigation.navigate('OTP', { phoneNumber: phone, isSignup: true });
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const canGoBack = navigation.canGoBack();

  return (
    <ScreenWrapper>
      <View style={styles.container}>

        {canGoBack && (
          <View style={styles.backRow}>
            <Ionicons
              name="chevron-back"
              size={28}
              color={COLORS.text}
              onPress={() => navigation.goBack()}
            />
          </View>
        )}

        {/* Main */}
        <View style={styles.main}>
          <Text style={styles.title}>Welcome to RoomBuddy</Text>
          <Text style={styles.subtitle}>Enter your phone number to continue</Text>

          <View style={styles.form}>
            <PhoneInput
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setError('');
                setAccountNotFound(false);
              }}
              error={error}
              autoFocus
            />

            <Button
              title="Continue"
              onPress={handleContinue}
              variant="primary"
              size="lg"
              loading={loading}
              disabled={phone.length < 10}
              full
            />

            {accountNotFound && (
              <View style={styles.notFoundBox}>
                <View style={styles.notFoundIconWrap}>
                  <Ionicons name="person-add-outline" size={20} color={COLORS.accent} />
                </View>
                <View style={styles.notFoundContent}>
                  <Text style={styles.notFoundTitle}>No account found</Text>
                  <Text style={styles.notFoundDesc}>
                    We couldn't find an account with this number.
                  </Text>
                  <Text style={styles.signUpLink} onPress={handleSignUp}>
                    Create a new account →
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        {/* Separate Texts in a wrapping row: a nested <Text> with a different
            fontFamily is clipped rather than wrapped on Android, which would
            hide the Terms / Privacy links on narrower screens. */}
        <View style={styles.termsRow}>
          <Text style={styles.terms}>By continuing, you agree to our </Text>
          <Text
            style={[styles.terms, styles.link]}
            onPress={() => Linking.openURL('https://roombuddy.co.in/terms')}
          >
            Terms of Service
          </Text>
          <Text style={styles.terms}> and </Text>
          <Text
            style={[styles.terms, styles.link]}
            onPress={() => Linking.openURL('https://roombuddy.co.in/privacy')}
          >
            Privacy Policy
          </Text>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backRow: {
    marginBottom: SPACING.md,
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
    color: COLORS.primary,
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
  terms: {
    fontSize: 13,
    color: COLORS.textMut,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  link: {
    color: COLORS.primary,
    ...FONTS.medium,
    textDecorationLine: 'underline',
  },
  // "No account found" card
  notFoundBox: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: COLORS.warm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FFE0D6',
  },
  notFoundIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  notFoundContent: {
    flex: 1,
  },
  notFoundTitle: {
    fontSize: 15,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  notFoundDesc: {
    fontSize: 13,
    color: COLORS.textSec,
    lineHeight: 19,
    marginBottom: 8,
  },
  signUpLink: {
    fontSize: 14,
    color: COLORS.accent,
    ...FONTS.bold,
  },
});