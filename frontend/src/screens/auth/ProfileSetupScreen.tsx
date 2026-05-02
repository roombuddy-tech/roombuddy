import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import Button from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../utils/errors';
import { isValidEmail } from '../../utils/validators';


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
  const [photoUri, setPhotoUri] = useState<string | null>(null);

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

      // Upload photo if selected
      if (photoUri) {
        try {
          const formData = new FormData();
          formData.append('image', {
            uri: photoUri,
            type: 'image/jpeg',
            name: 'profile.jpg',
          } as any);
          await api.post('/api/users/profile/upload-photo/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (photoErr) {
          console.log('Photo upload error (non-blocking):', photoErr);
        }
      }

      await completeProfile({
        first_name: firstName,
        last_name: lastName || firstName,
        display_name: `${firstName} ${lastName || firstName}`.trim(),
        city: city.trim(),
        gender,
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
            Alert.alert('Permission needed', 'Go to Settings and enable camera access for Expo Go.');
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
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.brand}>Room<Text style={styles.brandAccent}>Buddy</Text></Text>
        </View>

        <Text style={styles.title}>Complete your profile</Text>

        {/* Photo — optional */}
        <TouchableOpacity style={styles.photoSection} onPress={handlePickPhoto}>
          <View style={styles.photoCircle}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
            ) : (
              <Text style={styles.photoIcon}>📷</Text>
            )}
          </View>
          <Text style={styles.photoLabel}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
        </TouchableOpacity>

        {/* Full name */}
        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
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
            placeholder="Enter your email address"
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
                <Text style={[styles.pillText, gender === g.key && styles.pillTextActive]}>{g.label}</Text>
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
            placeholder="Enter your city"
            placeholderTextColor={COLORS.textMut}
          />
        </View>

        {/* Aadhaar note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteIcon}>🔒</Text>
          <Text style={styles.noteText}>Your Aadhaar verification will be done after signup. This keeps everyone safe.</Text>
        </View>

        {/* Submit */}
        <Button title="Start exploring" onPress={handleSubmit} variant="accent" size="lg" loading={loading} disabled={!isFormValid} full />
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
  photoImage: { width: 78, height: 78, borderRadius: 39 },

});