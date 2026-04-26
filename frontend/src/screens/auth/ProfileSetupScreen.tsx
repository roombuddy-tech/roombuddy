import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import Button from '../../components/ui/Button';
import { authService } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import { isValidEmail } from '../../utils/validators';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ProfileSetup'>;

const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'non_binary', label: 'Other' },
];

export default function ProfileSetupScreen({ navigation }: Props) {
  const { completeProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  const isFormValid = firstName.length >= 2 && gender && city.trim().length >= 2;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    if (email && !isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.completeProfile({
        first_name: firstName,
        last_name: lastName || firstName,
        email: email.trim() || undefined,
        gender,
        city: city.trim(),
      });

      await completeProfile(result);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Top bar — brand only, no avatar */}
        <View style={styles.topBar}>
          <Text style={styles.brand}>
            Room<Text style={styles.brandAccent}>Buddy</Text>
          </Text>
        </View>

        <Text style={styles.title}>Complete your profile</Text>


        {/* Photo — optional, not required */}
        <TouchableOpacity style={styles.photoSection}>
          <View style={styles.photoCircle}>
            <Text style={styles.photoIcon}>📷</Text>
          </View>
          <Text style={styles.photoLabel}>Add photo</Text>
        </TouchableOpacity>

        {/* Full name */}
        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Mayank Kumar"
            placeholderTextColor={COLORS.textMut}
            autoFocus
          />
        </View>

        {/* Email */}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="mayank@gmail.com"
            placeholderTextColor={COLORS.textMut}
            keyboardType="email-address"
            autoCapitalize="none"
          />
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
              >
                <Text style={[styles.pillText, gender === g.key && styles.pillTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* City */}
        <View style={styles.field}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Bengaluru"
            placeholderTextColor={COLORS.textMut}
          />
        </View>

        {/* Aadhaar note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteIcon}>🔒</Text>
          <Text style={styles.noteText}>
            Your Aadhaar verification will be done after signup. This keeps everyone safe.
          </Text>
        </View>

        {/* Submit */}
        <Button
          title="Start exploring"
          onPress={handleSubmit}
          variant="accent"
          size="lg"
          loading={loading}
          disabled={!isFormValid}
          full
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  topBar: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: SPACING.xl },
  brand: { fontSize: 24, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  title: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xl, textAlign: 'center' },
  photoSection: { alignItems: 'center', marginBottom: SPACING.xl },
  photoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  photoIcon: { fontSize: 28 },
  photoLabel: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },
  field: { marginBottom: SPACING.lg },
  label: { fontSize: 14, color: COLORS.textSec, ...FONTS.semibold, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.bg, ...FONTS.medium },
  pillRow: { flexDirection: 'row', gap: SPACING.sm },
  pill: { paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.pill, backgroundColor: COLORS.bg },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  pillText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  pillTextActive: { color: COLORS.primary, ...FONTS.semibold },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: SPACING.md, backgroundColor: COLORS.warm, borderRadius: RADIUS.md, marginBottom: SPACING.xl },
  noteIcon: { fontSize: 16 },
  noteText: { flex: 1, fontSize: 13, color: COLORS.accent, lineHeight: 18 },
});