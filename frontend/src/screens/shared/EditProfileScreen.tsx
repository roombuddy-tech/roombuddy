import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GooglePlacesInput from '../../components/forms/GooglePlacesInput';
import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme, useThemeColors } from '../../context/ThemeContext';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';



interface EditProfileProps {
  visible: boolean;
  onClose: () => void;
}

const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Others' },
];

export default function EditProfileScreen({ visible, onClose }: EditProfileProps) {
  const insets = useSafeAreaInsets();
  const { completeProfile } = useAuth();
  const COLORS = useThemeColors();
  const { mode } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [phone, setPhone] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible) fetchProfile();
  }, [visible]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.USER.PROFILE);
      const p = res.data;
      setFirstName(p.first_name || '');
      setLastName(p.last_name || '');
      setEmail(p.email || '');
      setGender(p.gender || '');
      setCity(p.city || '');
      setDob(p.date_of_birth ? new Date(p.date_of_birth) : null);
      setPhone(p.phone_number ? `${p.phone_country_code || '+91'} ${p.phone_number}` : '');   
    } catch (err) {
      console.log('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatDateISO = (date: Date | null): string | null => {
    if (!date) return null;
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDob(selectedDate);
    }
  };

  const handleSave = async () => {
    if (firstName.length < 2) {
      Alert.alert('Error', 'First name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(ENDPOINTS.USER.UPDATE_PROFILE, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        gender,
        city: city.trim(),
        date_of_birth: formatDateISO(dob),
      });
      await completeProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        city: city.trim(),
        gender,
      });
      Alert.alert('Success', 'Profile updated successfully.');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  // Max date = 18 years ago (minimum age)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);

  // Min date
  const minDate = new Date(1920, 0, 1);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.form}
        >
          <View style={styles.field}>
            <Text style={styles.label}>First name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={COLORS.textMut} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Last name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={COLORS.textMut} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Mobile number</Text>
            <View style={[styles.input, { backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center' }]}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMut} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 16, color: COLORS.textSec, ...FONTS.medium }}>{phone || 'Not available'}</Text>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={COLORS.textMut} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Date of birth</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
              <Text style={dob ? styles.dateText : styles.datePlaceholder}>
                {dob ? formatDate(dob) : 'Select your date of birth'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textMut} />
            </TouchableOpacity>

            {showDatePicker && (
              <View>
                <DateTimePicker
                  value={dob || maxDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={maxDate}
                  minimumDate={minDate}
                  onChange={onDateChange}
                  themeVariant={mode}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.pillRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity key={g.key} style={[styles.pill, gender === g.key && styles.pillActive]} onPress={() => setGender(g.key)}>
                  <Text style={[styles.pillText, gender === g.key && styles.pillTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.field, { zIndex: 10 }]}>
            <Text style={styles.label}>City</Text>
            <GooglePlacesInput
              value={city}
              placeholder="Search your city..."
              onSelect={(place) => setCity(place.city || place.description)}
            />
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  saveBtn: { fontSize: 16, color: COLORS.primary, ...FONTS.semibold },
  form: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
  field: { marginBottom: SPACING.lg },
  label: { fontSize: 14, color: COLORS.textSec, ...FONTS.semibold, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.bg, ...FONTS.medium },
  dateInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.bg },
  dateText: { fontSize: 16, color: COLORS.text, ...FONTS.medium },
  datePlaceholder: { fontSize: 16, color: COLORS.textMut, ...FONTS.medium },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 },
  doneBtnText: { fontSize: 16, color: COLORS.primary, ...FONTS.semibold },
  pillRow: { flexDirection: 'row', gap: SPACING.sm },
  pill: { paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.pill, backgroundColor: COLORS.bg },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  pillText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  pillTextActive: { color: COLORS.primary, ...FONTS.semibold },
});