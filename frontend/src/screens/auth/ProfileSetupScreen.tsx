import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import Button from '../../components/ui/Button';
import { authService } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import { isValidName, isValidEmail } from '../../utils/validators';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ProfileSetup'>;

const GENDERS = [
  { key: 'male', label: 'Male', icon: '👨' },
  { key: 'female', label: 'Female', icon: '👩' },
  { key: 'non_binary', label: 'Other', icon: '🧑' },
];

export default function ProfileSetupScreen({ navigation }: Props) {
  const { completeProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  const isFormValid = isValidName(firstName) && isValidName(lastName) && gender && city.trim().length >= 2;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    if (email && !isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.completeProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
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
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

        {/* Photo placeholder */}
        <TouchableOpacity style={styles.photoSection}>
          <View style={styles.photoCircle}>
            <Text style={styles.photoIcon}>📷</Text>
          </View>
          <Text style={styles.photoLabel}>Add photo</Text>
        </TouchableOpacity>

        {/* Name row */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>First name *</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Mayank"
              placeholderTextColor={COLORS.textMut}
              autoFocus
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Last name *</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Kumar"
              placeholderTextColor={COLORS.textMut}
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.field}>
          <Text style={styles.label}>Email (optional)</Text>
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
          <Text style={styles.label}>Gender *</Text>
          <View style={styles.pillRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.pill, gender === g.key && styles.pillActive]}
                onPress={() => setGender(g.key)}
              >
                <Text style={styles.pillIcon}>{g.icon}</Text>
                <Text style={[styles.pillText, gender === g.key && styles.pillTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* City */}
        <View style={styles.field}>
          <Text style={styles.label}>City *</Text>
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
            Aadhaar verification will be done later. This keeps everyone safe on the platform.
          </Text>
        </View>

        {/* Submit */}
        <Button
          title="Continue"
          onPress={handleSubmit}
          variant="primary"
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
  container: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  title: {
    fontSize: 26,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSec,
    marginBottom: SPACING.xl,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  photoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  photoIcon: { fontSize: 28 },
  photoLabel: {
    fontSize: 13,
    color: COLORS.primary,
    ...FONTS.semibold,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  halfInput: { flex: 1 },
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSec,
    ...FONTS.semibold,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    ...FONTS.medium,
  },
  pillRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
  },
  pillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryAlpha,
  },
  pillIcon: { fontSize: 16 },
  pillText: {
    fontSize: 14,
    color: COLORS.textSec,
    ...FONTS.medium,
  },
  pillTextActive: {
    color: COLORS.primary,
    ...FONTS.semibold,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.md,
    backgroundColor: COLORS.warm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xl,
    marginTop: SPACING.sm,
  },
  noteIcon: { fontSize: 16 },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.accent,
    lineHeight: 18,
  },
});