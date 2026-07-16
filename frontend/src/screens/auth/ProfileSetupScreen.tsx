import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GooglePlacesInput from '../../components/forms/GooglePlacesInput';
import Button from '../../components/ui/Button';
import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import api from '../../services/api';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../utils/errors';
import { isValidEmail } from '../../utils/validators';

type Props = NativeStackScreenProps<any, 'ProfileSetup'>;

const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Others' },
];

export default function ProfileSetupScreen({ navigation }: Props) {
  const { completeProfile } = useAuth();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const scrollRef = useRef<ScrollView>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [firstNameTouched, setFirstNameTouched] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);

  const firstNameError = firstNameTouched && firstName.trim().length > 0 && firstName.trim().length < 2
    ? 'First name must be at least 2 characters' : '';
  const lastNameError = lastNameTouched && lastName.trim().length > 0 && lastName.trim().length < 2
    ? 'Last name must be at least 2 characters' : '';

  const isFormValid =
    firstName.trim().length >= 2 && lastName.trim().length >= 2 && acceptedTerms;

  const handleVerifyEmail = async () => {
    if (!email.trim() || !isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setSendingEmail(true);
    try {
      await api.post(ENDPOINTS.USER.SEND_EMAIL_VERIFICATION, {
        email: email.trim(),
      });
      setEmailSent(true);
      Alert.alert(
        'Verification Sent',
        'Check your inbox and click the verification link.'
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        getErrorMessage(err, 'Failed to send verification email.')
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    try {
      const res = await api.get(ENDPOINTS.USER.VERIFICATION_STATUS);
      if (res.data.email_verified) {
        setEmailVerified(true);
        setEmailSent(false);
      } else {
        Alert.alert('Not yet', 'Email not verified yet. Please check your inbox and click the link.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not check verification status. Please try again.');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      if (!acceptedTerms) {
        setShowTermsError(true);
        scrollRef.current?.scrollToEnd({ animated: true });
      }
      return;
    }

    if (email && !isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.completeProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        gender: gender || undefined,
        city: city.trim() || undefined,
      });

      let profilePhotoUrl = null;
      if (photoUri) {
        try {
          const formData = new FormData();
          formData.append('image', {
            uri: photoUri,
            type: 'image/jpeg',
            name: 'profile.jpg',
          } as any);
          const photoRes = await api.post(
            ENDPOINTS.USER.UPLOAD_PHOTO,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          profilePhotoUrl = photoRes.data.profile_photo_url;
        } catch (photoErr) {
          console.log('Photo upload error (non-blocking):', photoErr);
        }
      }

      await completeProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        city: city.trim() || undefined,
        gender: gender || undefined,
        profile_photo_url: profilePhotoUrl,
      });
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to save profile.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert('Profile photo', 'Choose an option', [
      {
        text: 'Take photo',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission needed', 'Go to Settings and enable camera access.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.brand}>
              Room<Text style={styles.brandAccent}>Buddy</Text>
            </Text>
          </View>

          <Text style={styles.title}>Complete your profile</Text>

          {/* Photo */}
          <TouchableOpacity style={styles.photoSection} onPress={handlePickPhoto}>
            <View style={styles.photoCircle}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
              ) : (
                <Text style={styles.photoIcon}>📷</Text>
              )}
            </View>
            <Text style={styles.photoLabel}>
              {photoUri ? 'Change photo' : 'Add photo'}
            </Text>
          </TouchableOpacity>

          {/* First name */}
          <View style={styles.field}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              style={[styles.input, firstNameError ? styles.inputError : null]}
              value={firstName}
              onChangeText={setFirstName}
              onBlur={() => setFirstNameTouched(true)}
              placeholder="Enter your first name"
              placeholderTextColor={COLORS.textMut}
              autoFocus
            />
            {firstNameError ? <Text style={styles.errorText}>{firstNameError}</Text> : null}
          </View>

          {/* Last name */}
          <View style={styles.field}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              style={[styles.input, lastNameError ? styles.inputError : null]}
              value={lastName}
              onChangeText={setLastName}
              onBlur={() => setLastNameTouched(true)}
              placeholder="Enter your last name"
              placeholderTextColor={COLORS.textMut}
            />
            {lastNameError ? <Text style={styles.errorText}>{lastNameError}</Text> : null}
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setEmailSent(false);
                setEmailVerified(false);
              }}
              placeholder="Enter your email address"
              placeholderTextColor={COLORS.textMut}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Verified state */}
            {emailVerified && (
              <View style={styles.verifiedBanner}>
                <Text style={styles.verifiedBannerText}>✓ Email verified</Text>
              </View>
            )}

            {/* Send verification button */}
            {!emailVerified && email.trim() && isValidEmail(email) && !emailSent && (
              <TouchableOpacity
                style={[styles.verifyBtn, sendingEmail && styles.verifyBtnDisabled]}
                onPress={handleVerifyEmail}
                disabled={sendingEmail}
                accessibilityRole="button"
                accessibilityLabel="Send email verification link"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {sendingEmail
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.verifyBtnText}>Verify email now</Text>
                }
              </TouchableOpacity>
            )}

            {/* Post-send state */}
            {!emailVerified && emailSent && (
              <View style={styles.sentSection}>
                <Text style={styles.sentHint}>
                  Verification link sent to <Text style={styles.sentEmail}>{email}</Text>.
                  Click the link, then tap below.
                </Text>
                <TouchableOpacity
                  style={[styles.checkBtn, checkingVerification && styles.verifyBtnDisabled]}
                  onPress={handleCheckVerification}
                  disabled={checkingVerification}
                  accessibilityRole="button"
                  accessibilityLabel="Check email verification status"
                >
                  {checkingVerification
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.checkBtnText}>I've verified — refresh status</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={handleVerifyEmail} disabled={sendingEmail} style={styles.resendRow}>
                  <Text style={styles.resendText}>
                    {sendingEmail ? 'Sending...' : 'Resend email'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Gender */}
          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.pillRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.pill, gender === g.key && styles.pillActive]}
                  onPress={() => setGender(g.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gender === g.key }}
                  accessibilityLabel={g.label}
                >
                  <Text style={[styles.pillText, gender === g.key && styles.pillTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* City */}
          <View style={[styles.field, { zIndex: 10 }]}>
            <Text style={styles.label}>City</Text>
            <GooglePlacesInput
              value={city}
              placeholder="Search your city..."
              onSelect={(place) => setCity(place.city || place.description)}
            />
          </View>

          {/* Aadhaar note */}
          <View style={styles.noteCard}>
            <Text style={styles.noteIcon}>🔒</Text>
            <Text style={styles.noteText}>
              Your Aadhaar verification will be done after signup. This keeps everyone safe.
            </Text>
          </View>

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => {
              setAcceptedTerms(!acceptedTerms);
              setShowTermsError(false);
            }}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
              {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I have read and agree to the{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://roombuddy.co.in/terms/')}>
                Terms of Service
              </Text>{' '}and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://roombuddy.co.in/privacy/')}>
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          {showTermsError && (
            <Text style={styles.termsError}>
              Please accept the Terms &amp; Conditions to continue.
            </Text>
          )}

          {/* Submit */}
          <Button
            title="Start exploring"
            onPress={handleSubmit}
            variant="accent"
            size="lg"
            loading={loading}
            full
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  container: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  brand: { fontSize: 24, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.primary },
  title: {
    fontSize: 24,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  photoSection: { alignItems: 'center', marginBottom: SPACING.xl },
  photoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoIcon: { fontSize: 28 },
  photoLabel: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },
  field: { marginBottom: SPACING.lg },
  label: { fontSize: 14, color: COLORS.textSec, ...FONTS.semibold, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    ...FONTS.medium,
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4, ...FONTS.medium },
  verifyBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
    alignItems: 'center',
    minHeight: 38,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { color: '#fff', fontSize: 13, ...FONTS.semibold },
  verifiedBanner: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
  },
  verifiedBannerText: { fontSize: 13, color: '#15803D', ...FONTS.semibold },
  sentSection: { marginTop: 10 },
  sentHint: { fontSize: 13, color: COLORS.textSec, lineHeight: 19, marginBottom: 10 },
  sentEmail: { color: COLORS.text, ...FONTS.semibold },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    minHeight: 38,
  },
  checkBtnText: { color: '#fff', fontSize: 13, ...FONTS.semibold },
  resendRow: { marginTop: 8 },
  resendText: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },
  pillRow: { flexDirection: 'row', gap: SPACING.sm },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
  },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  pillText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  pillTextActive: { color: COLORS.primary, ...FONTS.semibold },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.md,
    backgroundColor: COLORS.warm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xl,
  },
  noteIcon: { fontSize: 16 },
  noteText: { flex: 1, fontSize: 13, color: COLORS.accent, lineHeight: 18 },
  photoImage: { width: 78, height: 78, borderRadius: 39 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: SPACING.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 13, ...FONTS.bold },
  termsText: { flex: 1, fontSize: 13, color: COLORS.textSec, lineHeight: 20 },
  termsLink: { color: COLORS.primary, ...FONTS.semibold, textDecorationLine: 'underline' },
  termsError: {
    fontSize: 12,
    color: '#EF4444',
    ...FONTS.medium,
    marginBottom: SPACING.md,
  },
});
