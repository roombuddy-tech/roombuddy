import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import type { HostStackParamList } from '../../navigation/types';
import { createListing } from '../../services/listings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Flatmate {
  id: string;
  name: string;
  age: string;
  occupation: string;
  hobbies: string;
}

interface FormData {
  apartmentType: string;
  floorNumber: string;
  totalFloors: string;
  apartmentName: string;
  locality: string;
  city: string;
  roomType: string;
  bedType: string;
  bathroom: string;
  roomSize: string;
  roomFeatures: string[];
  title: string;
  description: string;
  nearbyLandmarks: string[];
  distanceToLandmark: string;
  flatmates: Flatmate[];
  guestGenderPref: string;
  amenities: string[];
  kitchenAccess: boolean;
  homeCooked: boolean;
  nightlyRate: string;
  weeklyDiscount: boolean;
  minStay: string;
  noSmoking: boolean;
  noLoudMusic: boolean;
  noPets: boolean;
  noParties: boolean;
  shoesOff: boolean;
  kitchenClean: boolean;
  noAlcohol: boolean;
  lockDoor: boolean;
  customRules: string;
  cancellationPolicy: string;
  checkInTime: string;
  checkOutTime: string;
  photos: Record<string, string[]>;
}

const INIT: FormData = {
  apartmentType: '',
  floorNumber: '',
  totalFloors: '',
  apartmentName: '',
  locality: '',
  city: 'Bengaluru',
  roomType: '',
  bedType: '',
  bathroom: '',
  roomSize: '',
  roomFeatures: [],
  title: '',
  description: '',
  nearbyLandmarks: [],
  distanceToLandmark: '',
  flatmates: [],
  guestGenderPref: 'any',
  amenities: [],
  kitchenAccess: false,
  homeCooked: false,
  nightlyRate: '',
  weeklyDiscount: true,
  minStay: '1_night',
  noSmoking: true,
  noLoudMusic: true,
  noPets: true,
  noParties: true,
  shoesOff: true,
  kitchenClean: false,
  noAlcohol: false,
  lockDoor: false,
  customRules: '',
  cancellationPolicy: 'flexible',
  checkInTime: '',
  checkOutTime: '',
  photos: { bedroom: [], bathroom: [], kitchen: [], living: [], entrance: [], balcony: [], other: [] },
};

const TOTAL_STEPS = 9;

// ─── Constants ────────────────────────────────────────────────────────────────

const AMENITY_GROUPS = [
  {
    label: 'Essentials',
    items: ['WiFi', 'AC', 'Geyser / Hot water', 'Power backup', 'Washing machine', 'Iron', 'Hair dryer'],
  },
  {
    label: 'Kitchen & Food',
    items: ['Full kitchen access', 'Fridge', 'Microwave', 'Gas stove', 'Water purifier', 'Utensils provided'],
  },
  {
    label: 'Comfort',
    items: ['TV', 'Sofa / Common area', 'Workspace / Desk', 'Parking (2-wheeler)', 'Parking (4-wheeler)', 'Lift / Elevator'],
  },
  {
    label: 'Safety',
    items: ['CCTV (common areas)', 'Security guard', 'Fire extinguisher', 'First aid kit', 'Door lock on room'],
  },
];

const PHOTO_CATEGORIES = [
  { key: 'bedroom', label: 'Bedroom', icon: '🛏️', required: true },
  { key: 'bathroom', label: 'Bathroom', icon: '🚿', required: true },
  { key: 'kitchen', label: 'Kitchen', icon: '🍳', required: false },
  { key: 'living', label: 'Living / Common area', icon: '🛋️', required: false },
  { key: 'entrance', label: 'Building entrance', icon: '🏢', required: false },
  { key: 'balcony', label: 'Balcony / View', icon: '🌅', required: false },
];

const MIN_STAY_OPTIONS = [
  { value: '1_night', label: '1 night' },
  { value: '2_nights', label: '2 nights' },
  { value: '3_nights', label: '3 nights' },
  { value: '1_week', label: '1 week' },
];

const TIMES: string[] = (() => {
  const list: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const period = h < 12 ? 'AM' : 'PM';
      list.push(`${hour}:${m === 0 ? '00' : '30'} ${period}`);
    }
  }
  return list;
})();

// ─── Shared UI ────────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: SPACING.lg, paddingVertical: 12 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const idx = i + 1;
        const bg = idx < step ? COLORS.primary : idx === step ? COLORS.accent : COLORS.border;
        return <View key={idx} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: bg }} />;
      })}
    </View>
  );
}

function EditorHeader({ onSaveExit }: { onSaveExit: () => void }) {
  return (
    <View style={hdrSt.row}>
      <Text style={hdrSt.brand}>
        Room<Text style={{ color: COLORS.accent }}>Buddy</Text>
      </Text>
      <TouchableOpacity onPress={onSaveExit} style={hdrSt.saveBtn}>
        <Text style={hdrSt.saveTxt}>Save & exit</Text>
      </TouchableOpacity>
    </View>
  );
}

const hdrSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  brand: { fontSize: 20, ...FONTS.extrabold, color: COLORS.primaryDark },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveTxt: { fontSize: 13, ...FONTS.medium, color: COLORS.textSec },
});

interface StepProps {
  form: FormData;
  update: (u: Partial<FormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

function BottomNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  validate,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  validate?: () => string | null;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (validate) {
      const err = validate();
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    onNext();
  };

  return (
    <View style={{ marginTop: SPACING.xl, marginBottom: SPACING.lg }}>
      {error ? (
        <View style={bnSt.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={COLORS.danger} />
          <Text style={bnSt.errorTxt}>{error}</Text>
        </View>
      ) : null}
      <View style={bnSt.row}>
        <TouchableOpacity onPress={onBack} style={bnSt.back}>
          <Text style={bnSt.backTxt}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNext} style={bnSt.next} activeOpacity={0.85}>
          <Text style={bnSt.nextTxt}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const bnSt = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.sm },
  back: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backTxt: { fontSize: 15, ...FONTS.medium, color: COLORS.textSec },
  next: { flex: 3, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  nextTxt: { fontSize: 15, ...FONTS.semibold, color: '#fff' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  errorTxt: { fontSize: 13, color: COLORS.danger, flex: 1 },
});

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[cpSt.chip, selected && cpSt.sel]}
    >
      <Text style={[cpSt.lbl, selected && cpSt.lblSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const cpSt = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginRight: 8,
    marginBottom: 8,
  },
  sel: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  lbl: { fontSize: 13, ...FONTS.medium, color: COLORS.textSec },
  lblSel: { color: COLORS.primary, ...FONTS.semibold },
});

function AmenityChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[acSt.chip, selected && acSt.sel]}
    >
      {selected && (
        <Text style={{ fontSize: 11, marginRight: 4, color: COLORS.primary }}>✓</Text>
      )}
      <Text style={[acSt.lbl, selected && acSt.lblSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const acSt = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginRight: 8,
    marginBottom: 8,
  },
  sel: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  lbl: { fontSize: 13, ...FONTS.medium, color: COLORS.textSec },
  lblSel: { color: COLORS.primary, ...FONTS.semibold },
});

function RequiredMark() {
  return <Text style={{ color: COLORS.danger }}> *</Text>;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  multiline,
  keyboardType,
  required,
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: any;
  required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={fldSt.label}>
          {label}
          {required && <RequiredMark />}
        </Text>
      ) : null}
      <TextInput
        style={[fldSt.input, multiline && fldSt.multiline]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMut}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const fldSt = StyleSheet.create({
  label: { fontSize: 13, ...FONTS.medium, color: COLORS.textSec, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  multiline: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
});

function SectionLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={{ fontSize: 13, ...FONTS.semibold, color: COLORS.textSec, marginTop: 16, marginBottom: 8 }}>
      {label}
      {required && <RequiredMark />}
    </Text>
  );
}

function RuleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={rrSt.row}>
      <Text style={rrSt.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#fff"
        ios_backgroundColor={COLORS.border}
      />
    </View>
  );
}

const rrSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: { fontSize: 15, color: COLORS.text, flex: 1, ...FONTS.regular },
});

// ─── Time Picker ──────────────────────────────────────────────────────────────

function TimePicker({
  label,
  value,
  onChange,
  required,
  placeholder = 'Select time',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={fldSt.label}>
        {label}
        {required && <RequiredMark />}
      </Text>
      <TouchableOpacity
        style={tpSt.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[tpSt.triggerTxt, !value && { color: COLORS.textMut }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="time-outline" size={18} color={COLORS.textSec} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={tpSt.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={tpSt.sheet}>
            <View style={tpSt.sheetHeader}>
              <Text style={tpSt.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSec} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {TIMES.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[tpSt.timeRow, value === time && tpSt.timeRowSel]}
                  onPress={() => { onChange(time); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  {value === time && (
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  )}
                  <Text style={[tpSt.timeTxt, value === time && tpSt.timeSel]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const tpSt = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.bg,
  },
  triggerTxt: { fontSize: 15, color: COLORS.text },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: SPACING.xxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.text },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  timeRowSel: { backgroundColor: COLORS.primaryAlpha },
  timeTxt: { fontSize: 16, color: COLORS.text },
  timeSel: { color: COLORS.primary, ...FONTS.semibold },
});

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={wlSt.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={wlSt.hero}>
        <Text style={{ fontSize: 56, marginBottom: SPACING.md }}>🏠</Text>
        <Text style={wlSt.title}>List your spare room</Text>
        <Text style={wlSt.sub}>
          Turn your temporarily empty room into income.{'\n'}Takes just 8 minutes.
        </Text>
      </View>

      {[
        { icon: '📝', label: 'Property & room details' },
        { icon: '👥', label: 'Flatmate profiles' },
        { icon: '📸', label: 'Photos' },
        { icon: '💰', label: 'Pricing & availability' },
      ].map((s) => (
        <View key={s.label} style={wlSt.card}>
          <Text style={{ fontSize: 26, marginRight: 12 }}>{s.icon}</Text>
          <Text style={{ fontSize: 15, ...FONTS.medium, color: COLORS.text }}>{s.label}</Text>
        </View>
      ))}

      <TouchableOpacity style={wlSt.cta} onPress={onNext} activeOpacity={0.85}>
        <Text style={{ color: '#fff', fontSize: 16, ...FONTS.semibold }}>Get started</Text>
      </TouchableOpacity>

      <Text style={wlSt.footnote}>Free to list. You pay 3–5% only when booked.</Text>
    </ScrollView>
  );
}

const wlSt = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  hero: { alignItems: 'center', marginBottom: SPACING.xl },
  title: { fontSize: 28, ...FONTS.bold, color: COLORS.primaryDark, textAlign: 'center', marginBottom: SPACING.sm },
  sub: { fontSize: 15, color: COLORS.textSec, textAlign: 'center', lineHeight: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
    ...SHADOW.sm,
  },
  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  footnote: { textAlign: 'center', fontSize: 12, color: COLORS.textMut, marginTop: SPACING.md },
});

// ─── Step 1: Your Property ────────────────────────────────────────────────────

function StepProperty({ form, update, onNext, onBack }: StepProps) {
  const validate = (): string | null => {
    if (!form.apartmentType) return 'Please select an apartment type';
    if (!form.floorNumber.trim()) return 'Please enter the floor number';
    if (!form.apartmentName.trim()) return 'Please enter the society / apartment name';
    if (!form.locality.trim()) return 'Please enter the locality / area';
    if (!form.city.trim()) return 'Please enter the city';
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={stSt.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={stSt.title}>Your property</Text>
        <Text style={stSt.sub}>Tell us about the apartment where the room is located.</Text>

        <SectionLabel label="Apartment type" required />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['1BHK', '2BHK', '3BHK', '4BHK+'].map((t) => (
            <Chip
              key={t}
              label={t}
              selected={form.apartmentType === t}
              onPress={() => update({ apartmentType: t })}
            />
          ))}
        </View>

        <Field
          label="Floor number"
          placeholder="e.g. 3rd floor"
          value={form.floorNumber}
          onChange={(v) => update({ floorNumber: v })}
          required
        />
        <Field
          label="Total floors in building"
          placeholder="e.g. 5"
          value={form.totalFloors}
          onChange={(v) => update({ totalFloors: v })}
          keyboardType="number-pad"
        />
        <Field
          label="Society / Apartment name"
          placeholder="e.g. Prestige Shantiniketan"
          value={form.apartmentName}
          onChange={(v) => update({ apartmentName: v })}
          required
        />
        <Field
          label="Locality / Area"
          placeholder="e.g. Koramangala 5th Block"
          value={form.locality}
          onChange={(v) => update({ locality: v })}
          required
        />
        <Field
          label="City"
          placeholder="City"
          value={form.city}
          onChange={(v) => update({ city: v })}
          required
        />

        <View style={stSt.infoBox}>
          <Text style={{ fontSize: 12, color: COLORS.primaryDark, lineHeight: 18 }}>
            📍 Your exact address is shared only after a booking is confirmed. Guests see only the neighbourhood on the map.
          </Text>
        </View>

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 2: Room Details ─────────────────────────────────────────────────────

function StepRoom({ form, update, onNext, onBack }: StepProps) {
  const toggleFeature = (f: string) => {
    const cur = form.roomFeatures;
    update({ roomFeatures: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] });
  };

  const validate = (): string | null => {
    if (!form.roomType) return 'Please select a room type';
    if (!form.bedType) return 'Please select a bed type';
    if (!form.bathroom) return 'Please select a bathroom type';
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={stSt.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={stSt.title}>Room details</Text>
        <Text style={stSt.sub}>Describe the room you're renting out.</Text>

        <SectionLabel label="Room type" required />
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm }}>
          <TouchableOpacity
            style={[rdSt.typeCard, form.roomType === 'private' && rdSt.typeCardSel]}
            onPress={() => update({ roomType: 'private' })}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 22, marginBottom: 4 }}>🚪</Text>
            <Text style={[rdSt.typeTitle, form.roomType === 'private' && { color: COLORS.primary }]}>
              Private room
            </Text>
            <Text style={rdSt.typeSub}>Guest gets their own room with a door lock</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[rdSt.typeCard, form.roomType === 'shared' && rdSt.typeCardSel]}
            onPress={() => update({ roomType: 'shared' })}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 22, marginBottom: 4 }}>🛏️</Text>
            <Text style={[rdSt.typeTitle, form.roomType === 'shared' && { color: COLORS.primary }]}>
              Shared room
            </Text>
            <Text style={rdSt.typeSub}>Guest shares the room with others</Text>
          </TouchableOpacity>
        </View>

        <SectionLabel label="Bed type" required />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['Single', 'Double', 'Queen', 'King', 'Mattress'].map((b) => (
            <Chip
              key={b}
              label={b}
              selected={form.bedType === b.toLowerCase()}
              onPress={() => update({ bedType: b.toLowerCase() })}
            />
          ))}
        </View>

        <SectionLabel label="Bathroom" required />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[
            { value: 'attached', label: 'Attached' },
            { value: 'shared', label: 'Common / Shared' },
          ].map((b) => (
            <Chip
              key={b.value}
              label={b.label}
              selected={form.bathroom === b.value}
              onPress={() => update({ bathroom: b.value })}
            />
          ))}
        </View>

        <Field
          label="Room size (optional)"
          placeholder="e.g. 12x14 ft"
          value={form.roomSize}
          onChange={(v) => update({ roomSize: v })}
        />

        <SectionLabel label="Room has" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['Door lock', 'Window', 'Balcony', 'Wardrobe', 'Study table', 'Mirror', 'Bookshelf', 'Curtains'].map(
            (f) => (
              <Chip
                key={f}
                label={f}
                selected={form.roomFeatures.includes(f)}
                onPress={() => toggleFeature(f)}
              />
            )
          )}
        </View>

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const rdSt = StyleSheet.create({
  typeCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  typeCardSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  typeTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  typeSub: { fontSize: 12, color: COLORS.textSec, lineHeight: 16 },
});

// ─── Step 3: Title & Description ──────────────────────────────────────────────

function StepTitle({ form, update, onNext, onBack }: StepProps) {
  const LANDMARKS = ['Metro station', 'Bus stop', 'Tech park', 'Mall', 'Hospital', 'Restaurant hub'];

  const toggleLandmark = (l: string) => {
    const cur = form.nearbyLandmarks;
    update({ nearbyLandmarks: cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l] });
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Please add a listing title';
    if (!form.description.trim()) return 'Please add a description of your space';
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={stSt.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={stSt.title}>Title & description</Text>
        <Text style={stSt.sub}>This is the first thing guests see. Make it count!</Text>

        <Field
          label="Listing title"
          placeholder='e.g. Cozy private room in 2BHK, Koramangala'
          value={form.title}
          onChange={(v) => update({ title: v })}
          required
        />

        <Field
          label="Description"
          placeholder="Describe your space — what makes it special, what guests can expect, nearby landmarks, transport access, what your flatmates are like to live with..."
          value={form.description}
          onChange={(v) => update({ description: v })}
          multiline
          required
        />

        <SectionLabel label="Nearby landmarks (optional)" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {LANDMARKS.map((l) => (
            <Chip
              key={l}
              label={l}
              selected={form.nearbyLandmarks.includes(l)}
              onPress={() => toggleLandmark(l)}
            />
          ))}
        </View>

        <Field
          label="Distance to nearest landmark (optional)"
          placeholder="e.g. 5 min walk from Koramangala bus stop"
          value={form.distanceToLandmark}
          onChange={(v) => update({ distanceToLandmark: v })}
        />

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 4: Flatmates ────────────────────────────────────────────────────────

function StepFlatmates({ form, update, onNext, onBack }: StepProps) {
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState({ name: '', age: '', occupation: '', hobbies: '' });

  const displayName: string =
    user?.display_name || user?.first_name || user?.profile?.first_name || 'You';
  const city: string = user?.city || user?.profile?.city || form.city;

  const saveFlatmate = () => {
    if (!draft.name.trim()) return;
    const flatmate: Flatmate = {
      id: Date.now().toString(),
      name: draft.name,
      age: draft.age,
      occupation: draft.occupation,
      hobbies: draft.hobbies,
    };
    update({ flatmates: [...form.flatmates, flatmate] });
    setDraft({ name: '', age: '', occupation: '', hobbies: '' });
    setModalVisible(false);
  };

  const removeFlatmate = (id: string) => {
    update({ flatmates: form.flatmates.filter((f) => f.id !== id) });
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={stSt.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={stSt.title}>Your flatmates</Text>

      <View style={fmSt.banner}>
        <Text style={fmSt.bannerTxt}>⭐ Listings with flatmate profiles get 3x more bookings</Text>
      </View>

      <View style={fmSt.card}>
        <View style={fmSt.avatar}>
          <Text style={fmSt.avatarTxt}>{initials(displayName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fmSt.name}>{displayName}</Text>
          {city ? <Text style={fmSt.detail}>{city}</Text> : null}
        </View>
        <View style={fmSt.youBadge}>
          <Text style={fmSt.youTxt}>You</Text>
        </View>
      </View>

      {form.flatmates.map((fm) => (
        <View key={fm.id} style={fmSt.card}>
          <View style={fmSt.avatar}>
            <Text style={fmSt.avatarTxt}>{initials(fm.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={fmSt.name}>
              {fm.name}
              {fm.age ? `, ${fm.age}` : ''}
            </Text>
            {fm.occupation || fm.hobbies ? (
              <Text style={fmSt.detail} numberOfLines={1}>
                {[fm.occupation, fm.hobbies].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => removeFlatmate(fm.id)} style={{ padding: 6 }}>
            <Ionicons name="close-circle-outline" size={20} color={COLORS.textMut} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={fmSt.addCard}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={24} color={COLORS.primary} />
        <Text style={fmSt.addTxt}>Add flatmate</Text>
      </TouchableOpacity>

      <SectionLabel label="Guest gender preference" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[
          { value: 'male_only', label: 'Male only' },
          { value: 'female_only', label: 'Female only' },
          { value: 'any', label: 'Any gender' },
        ].map((g) => (
          <Chip
            key={g.value}
            label={g.label}
            selected={form.guestGenderPref === g.value}
            onPress={() => update({ guestGenderPref: g.value })}
          />
        ))}
      </View>

      <BottomNav onBack={onBack} onNext={onNext} />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={fmSt.modalOverlay}>
          <View style={fmSt.modalSheet}>
            <View style={fmSt.modalHeader}>
              <Text style={fmSt.modalTitle}>Add flatmate</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSec} />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Field
                  label="Name"
                  placeholder="e.g. Mayank K."
                  value={draft.name}
                  onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                />
                <Field
                  label="Age"
                  placeholder="e.g. 26"
                  value={draft.age}
                  onChange={(v) => setDraft((d) => ({ ...d, age: v }))}
                  keyboardType="number-pad"
                />
                <Field
                  label="Occupation"
                  placeholder="e.g. SE at Google"
                  value={draft.occupation}
                  onChange={(v) => setDraft((d) => ({ ...d, occupation: v }))}
                />
                <Field
                  label="Hobbies (optional)"
                  placeholder="e.g. Cricket, Cooking"
                  value={draft.hobbies}
                  onChange={(v) => setDraft((d) => ({ ...d, hobbies: v }))}
                />
                <TouchableOpacity
                  style={fmSt.saveBtn}
                  onPress={saveFlatmate}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#fff', fontSize: 15, ...FONTS.semibold }}>Save</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const fmSt = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF7ED',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  bannerTxt: { fontSize: 13, color: '#92400E' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarTxt: { fontSize: 14, ...FONTS.bold, color: COLORS.primary },
  name: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  detail: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  youBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryAlpha,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  youTxt: { fontSize: 12, ...FONTS.medium, color: COLORS.primary },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: SPACING.sm,
    gap: 6,
  },
  addTxt: { fontSize: 14, ...FONTS.medium, color: COLORS.primary },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
});

// ─── Step 5: Amenities & Food ─────────────────────────────────────────────────

function StepAmenities({ form, update, onNext, onBack }: StepProps) {
  const toggleAmenity = (a: string) => {
    const cur = form.amenities;
    update({ amenities: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] });
  };

  const validate = (): string | null => {
    for (const group of AMENITY_GROUPS) {
      const hasOne = group.items.some((item) => form.amenities.includes(item));
      if (!hasOne) return `Please select at least one item from "${group.label}"`;
    }
    return null;
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={stSt.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={stSt.title}>Amenities & food</Text>
      <Text style={stSt.sub}>What does your apartment offer? Select all that apply.</Text>

      {AMENITY_GROUPS.map((group) => (
        <View key={group.label}>
          <SectionLabel label={group.label} required />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {group.items.map((item) => (
              <AmenityChip
                key={item}
                label={item}
                selected={form.amenities.includes(item)}
                onPress={() => toggleAmenity(item)}
              />
            ))}
          </View>
        </View>
      ))}

      <SectionLabel label="Food options for guests" />
      <RuleRow
        label="Guests can use the kitchen"
        value={form.kitchenAccess}
        onChange={(v) => update({ kitchenAccess: v })}
      />
      <RuleRow
        label="I can provide home-cooked meals (extra charge)"
        value={form.homeCooked}
        onChange={(v) => update({ homeCooked: v })}
      />

      <BottomNav onBack={onBack} onNext={onNext} validate={validate} />
    </ScrollView>
  );
}

// ─── Step 6: Photos ───────────────────────────────────────────────────────────

function StepPhotos({ form, update, onNext, onBack }: StepProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const pickPhotos = async (category: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    setLoading(category);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        const uris = result.assets.map((a) => a.uri);
        update({
          photos: {
            ...form.photos,
            [category]: [...(form.photos[category] ?? []), ...uris],
          },
        });
      }
    } finally {
      setLoading(null);
    }
  };

  const removePhoto = (category: string, index: number) => {
    const updated = (form.photos[category] ?? []).filter((_, i) => i !== index);
    update({ photos: { ...form.photos, [category]: updated } });
  };

  const validate = (): string | null => {
    if (!form.photos.bedroom?.length) return 'Please add at least 1 photo of the bedroom';
    if (!form.photos.bathroom?.length) return 'Please add at least 1 photo of the bathroom';
    return null;
  };

  const totalPhotos = Object.values(form.photos).reduce((sum, arr) => sum + arr.length, 0);
  const otherPhotos = form.photos.other ?? [];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={stSt.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={stSt.title}>Photos</Text>
      <Text style={stSt.sub}>
        Great photos = more bookings.{' '}
        <Text style={{ color: totalPhotos >= 5 ? COLORS.success : COLORS.accent }}>
          {totalPhotos}/5 added
        </Text>
      </Text>

      <View style={phSt.tipBox}>
        <Text style={phSt.tipTxt}>
          💡 Use natural light · Landscape orientation · Show the full room · Clean and declutter · Required: Bedroom & Bathroom
        </Text>
      </View>

      {/* Category grid */}
      <View style={phSt.grid}>
        {PHOTO_CATEGORIES.map((cat) => {
          const photos = form.photos[cat.key] ?? [];
          const isLoading = loading === cat.key;
          const isEmpty = photos.length === 0;

          if (isEmpty) {
            // Empty state — full card is tappable
            return (
              <TouchableOpacity
                key={cat.key}
                style={phSt.catCard}
                activeOpacity={0.7}
                onPress={() => pickPhotos(cat.key)}
              >
                {cat.required && (
                  <View style={phSt.requiredBadge}>
                    <Text style={phSt.requiredTxt}>Required</Text>
                  </View>
                )}
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{cat.icon}</Text>
                <Text style={phSt.catLabel}>{cat.label}</Text>
                <Text style={phSt.catSub}>{isLoading ? 'Loading…' : 'Tap to add'}</Text>
              </TouchableOpacity>
            );
          }

          // Filled state — show thumbnails with individual X buttons
          return (
            <View key={cat.key} style={[phSt.catCard, phSt.catCardFilled]}>
              <View style={phSt.cardTopRow}>
                <Text style={[phSt.catLabel, { color: COLORS.primary, marginBottom: 0 }]} numberOfLines={1}>
                  {cat.label}
                </Text>
                <Text style={phSt.countPill}>
                  {photos.length} photo{photos.length > 1 ? 's' : ''}
                </Text>
              </View>

              <View style={phSt.thumbsRow}>
                {photos.map((uri, idx) => (
                  <View key={`${cat.key}-${idx}`} style={phSt.thumbWrap}>
                    <Image source={{ uri }} style={phSt.thumbSm} resizeMode="cover" />
                    <TouchableOpacity
                      style={phSt.removeBtn}
                      onPress={() => removePhoto(cat.key, idx)}
                      hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {/* Add more */}
                <TouchableOpacity
                  style={phSt.addMoreBtn}
                  onPress={() => pickPhotos(cat.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Upload uncategorised photos */}
      <TouchableOpacity
        style={phSt.uploadBox}
        activeOpacity={0.7}
        onPress={() => pickPhotos('other')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 26 }}>
            {loading === 'other' ? '⏳' : '📷'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={phSt.uploadTitle}>
              Other photos{otherPhotos.length > 0 ? `  ·  ${otherPhotos.length} added` : ''}
            </Text>
            <Text style={phSt.uploadSub}>
              Exterior view, street access, common areas, or any photo that doesn't fit a specific room category
            </Text>
          </View>
          <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
        </View>
      </TouchableOpacity>

      {/* "Other" thumbnails shown outside the tappable box so X buttons work cleanly */}
      {otherPhotos.length > 0 && (
        <View style={phSt.otherThumbsRow}>
          {otherPhotos.map((uri, idx) => (
            <View key={`other-${idx}`} style={phSt.thumbWrap}>
              <Image source={{ uri }} style={phSt.thumbMd} resizeMode="cover" />
              <TouchableOpacity
                style={phSt.removeBtn}
                onPress={() => removePhoto('other', idx)}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
              >
                <Ionicons name="close-circle" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <BottomNav onBack={onBack} onNext={onNext} validate={validate} />
    </ScrollView>
  );
}

const phSt = StyleSheet.create({
  tipBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tipTxt: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  catCard: {
    width: '47.5%',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    position: 'relative',
    minHeight: 110,
    justifyContent: 'center',
  },
  catCardFilled: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: COLORS.bg,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  countPill: {
    fontSize: 10,
    ...FONTS.semibold,
    color: COLORS.primary,
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  thumbsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    width: '100%',
  },
  thumbWrap: { position: 'relative' },
  thumbSm: { width: 44, height: 44, borderRadius: RADIUS.sm },
  thumbMd: { width: 64, height: 64, borderRadius: RADIUS.sm },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 9,
    lineHeight: 18,
  },
  addMoreBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryAlpha,
  },
  otherThumbsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: SPACING.sm,
  },
  requiredBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  requiredTxt: { fontSize: 10, color: '#fff', ...FONTS.semibold },
  catLabel: { fontSize: 12, ...FONTS.semibold, color: COLORS.text, textAlign: 'center', marginTop: 4 },
  catSub: { fontSize: 11, color: COLORS.textMut, marginTop: 1 },
  uploadBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    backgroundColor: COLORS.primaryAlpha,
    marginBottom: SPACING.sm,
  },
  uploadTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.primary },
  uploadSub: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
});

// ─── Step 7: Set Your Price ───────────────────────────────────────────────────

function StepPrice({ form, update, onNext, onBack }: StepProps) {
  const rate = parseInt(form.nightlyRate, 10) || 0;
  const serviceFee = Math.round(rate * 0.08);
  const gst = Math.round(serviceFee * 0.18);
  const guestTotal = rate + serviceFee + gst;
  const hostFee = Math.round(rate * 0.03);
  const hostEarning = rate - hostFee;

  const validate = (): string | null => {
    if (!form.nightlyRate || parseInt(form.nightlyRate, 10) < 1)
      return 'Please set your nightly rate to continue';
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={stSt.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={stSt.title}>Set your price</Text>
        <Text style={stSt.sub}>Set your nightly rate. We'll show you what guests pay and what you earn.</Text>

        {form.locality ? (
          <View style={prSt.smartBox}>
            <Text style={prSt.smartTxt}>
              💡 Smart price suggestion{'\n'}
              <Text style={{ ...FONTS.regular }}>
                Based on similar rooms in {form.locality}, we recommend ₹750–₹1,000/night. Rooms
                with AC and kitchen access average ₹850/night.
              </Text>
            </Text>
          </View>
        ) : null}

        <Text style={fldSt.label}>
          Your nightly rate <RequiredMark />
        </Text>
        <View style={prSt.rateRow}>
          <Text style={prSt.rupee}>₹</Text>
          <TextInput
            style={prSt.rateInput}
            value={form.nightlyRate}
            onChangeText={(v) => update({ nightlyRate: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder="850"
            placeholderTextColor={COLORS.textMut}
          />
          <Text style={prSt.perNight}>per night</Text>
        </View>

        {rate > 0 && (
          <>
            <View style={prSt.breakdownBox}>
              <Text style={prSt.breakdownTitle}>Price breakdown (guest pays)</Text>
              <PriceRow label="Room rate" value={`₹${rate}`} />
              <PriceRow label="RoomBuddy service fee (8%)" value={`₹${serviceFee}`} />
              <PriceRow label="GST (18% on fee)" value={`₹${gst}`} />
              <View style={prSt.divider} />
              <PriceRow label="Guest total" value={`₹${guestTotal}/night`} bold />
            </View>

            <View style={prSt.breakdownBox}>
              <Text style={prSt.breakdownTitle}>You earn</Text>
              <PriceRow label="Room rate" value={`₹${rate}`} />
              <PriceRow label="RoomBuddy host fee (3%)" value={`−₹${hostFee}`} muted />
              <View style={prSt.divider} />
              <PriceRow label="Your earning" value={`₹${hostEarning}/night`} bold />
            </View>
          </>
        )}

        <View style={prSt.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={prSt.toggleLabel}>Weekly discount (7+ nights: 10% off)</Text>
          </View>
          <Switch
            value={form.weeklyDiscount}
            onValueChange={(v) => update({ weeklyDiscount: v })}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#fff"
            ios_backgroundColor={COLORS.border}
          />
        </View>

        <SectionLabel label="Minimum stay" />
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          {MIN_STAY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[prSt.minStayBtn, form.minStay === opt.value && prSt.minStayBtnSel]}
              onPress={() => update({ minStay: opt.value })}
              activeOpacity={0.7}
            >
              <Text style={[prSt.minStayTxt, form.minStay === opt.value && prSt.minStayTxtSel]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PriceRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text
        style={{
          fontSize: 14,
          color: muted ? COLORS.textMut : COLORS.textSec,
          ...(bold ? FONTS.semibold : FONTS.regular),
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: muted ? COLORS.textMut : COLORS.text,
          ...(bold ? FONTS.bold : FONTS.regular),
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const prSt = StyleSheet.create({
  smartBox: {
    backgroundColor: COLORS.primaryAlpha,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  smartTxt: { fontSize: 13, color: COLORS.primaryDark, ...FONTS.semibold, lineHeight: 20 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    gap: 8,
  },
  rupee: { fontSize: 28, ...FONTS.bold, color: COLORS.text },
  rateInput: {
    fontSize: 52,
    ...FONTS.bold,
    color: COLORS.text,
    minWidth: 120,
    textAlign: 'center',
  },
  perNight: { fontSize: 14, color: COLORS.textSec, alignSelf: 'flex-end', paddingBottom: 8 },
  breakdownBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  breakdownTitle: { fontSize: 13, ...FONTS.semibold, color: COLORS.textSec, marginBottom: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggleLabel: { fontSize: 15, color: COLORS.text, ...FONTS.regular },
  minStayBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  minStayBtnSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  minStayTxt: { fontSize: 12, ...FONTS.medium, color: COLORS.textSec },
  minStayTxtSel: { color: COLORS.primary, ...FONTS.semibold },
});

// ─── Step 8: House Rules ──────────────────────────────────────────────────────

function StepRules({ form, update, onNext, onBack }: StepProps) {
  const CANCELLATION_OPTIONS = [
    { value: 'flexible', title: 'Flexible', sub: 'Full refund up to 24 hours before check-in' },
    { value: 'moderate', title: 'Moderate', sub: 'Full refund up to 5 days before check-in' },
    { value: 'strict', title: 'Strict', sub: 'No refund within 7 days of check-in' },
  ];

  const validate = (): string | null => {
    if (!form.checkInTime) return 'Please select a check-in time';
    if (!form.checkOutTime) return 'Please select a check-out time';
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={stSt.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={stSt.title}>House rules</Text>
        <Text style={stSt.sub}>Set clear expectations for your guests. This prevents misunderstandings.</Text>

        <Text style={{ fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginTop: SPACING.sm, marginBottom: 4 }}>
          Common rules
        </Text>

        <RuleRow label="No smoking inside the apartment" value={form.noSmoking} onChange={(v) => update({ noSmoking: v })} />
        <RuleRow label="No loud music after 10 PM" value={form.noLoudMusic} onChange={(v) => update({ noLoudMusic: v })} />
        <RuleRow label="No pets allowed" value={form.noPets} onChange={(v) => update({ noPets: v })} />
        <RuleRow label="No parties or events" value={form.noParties} onChange={(v) => update({ noParties: v })} />
        <RuleRow label="Guests must remove shoes indoors" value={form.shoesOff} onChange={(v) => update({ shoesOff: v })} />
        <RuleRow label="Keep kitchen clean after use" value={form.kitchenClean} onChange={(v) => update({ kitchenClean: v })} />
        <RuleRow label="No alcohol consumption in common areas" value={form.noAlcohol} onChange={(v) => update({ noAlcohol: v })} />
        <RuleRow label="Lock the door when leaving" value={form.lockDoor} onChange={(v) => update({ lockDoor: v })} />

        <Field
          label="Custom rules (optional)"
          placeholder="e.g. Please don't use the washing machine after 9 PM..."
          value={form.customRules}
          onChange={(v) => update({ customRules: v })}
          multiline
        />

        <Text style={{ fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginTop: SPACING.md, marginBottom: 8 }}>
          Cancellation policy
        </Text>
        {CANCELLATION_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[rlSt.policyCard, form.cancellationPolicy === opt.value && rlSt.policyCardSel]}
            onPress={() => update({ cancellationPolicy: opt.value })}
            activeOpacity={0.7}
          >
            <Text style={[rlSt.policyTitle, form.cancellationPolicy === opt.value && { color: COLORS.primary }]}>
              {opt.title}
            </Text>
            <Text style={rlSt.policySub}>{opt.sub}</Text>
          </TouchableOpacity>
        ))}

        <Text style={{ fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginTop: SPACING.lg, marginBottom: 4 }}>
          Check-in / Check-out
        </Text>

        <TimePicker
          label="Check-in time"
          value={form.checkInTime}
          onChange={(v) => update({ checkInTime: v })}
          required
          placeholder="e.g. 2:00 PM"
        />
        <TimePicker
          label="Check-out time"
          value={form.checkOutTime}
          onChange={(v) => update({ checkOutTime: v })}
          required
          placeholder="e.g. 11:00 AM"
        />

        <BottomNav onBack={onBack} onNext={onNext} nextLabel="Review & publish" validate={validate} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const rlSt = StyleSheet.create({
  policyCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  policyCardSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  policyTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  policySub: { fontSize: 13, color: COLORS.textSec },
});

// ─── Step 9: Review & Publish ─────────────────────────────────────────────────

function StepReview({
  form,
  onBack,
  goToStep,
  submitting,
  setSubmitting,
  onSuccess,
}: {
  form: FormData;
  onBack: () => void;
  goToStep: (s: number) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const rate = parseInt(form.nightlyRate, 10) || 0;
  const amenityHighlights = form.amenities.slice(0, 3).join(', ');
  const ruleCount = [
    form.noSmoking, form.noLoudMusic, form.noPets, form.noParties,
    form.shoesOff, form.kitchenClean, form.noAlcohol, form.lockDoor,
  ].filter(Boolean).length;
  const totalPhotos = Object.values(form.photos).reduce((s, a) => s + a.length, 0);

  const handlePublish = () => {
    Alert.alert(
      'Submit for review',
      'Your listing will be reviewed by our team and go live within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: doPublish },
      ]
    );
  };

  const doPublish = async () => {
    setSubmitting(true);
    try {
      await createListing(form);
      Alert.alert(
        'Listing submitted!',
        "We'll notify you once it's live.",
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const tags = [
    form.roomType === 'private' ? 'Private room' : form.roomType === 'shared' ? 'Shared room' : null,
    form.amenities.includes('AC') ? 'AC' : null,
    form.amenities.includes('Full kitchen access') || form.kitchenAccess ? 'Kitchen' : null,
  ].filter(Boolean) as string[];

  const coverUri = Object.values(form.photos).find((arr) => arr.length > 0)?.[0];

  const SUMMARY_ROWS = [
    {
      label: 'Property',
      step: 1,
      value: [form.apartmentType, form.floorNumber ? `${form.floorNumber} floor` : null, form.apartmentName, form.locality]
        .filter(Boolean).join(' · '),
    },
    { label: 'Title', step: 3, value: form.title },
    {
      label: 'Room',
      step: 2,
      value: [
        form.roomType === 'private' ? 'Private' : form.roomType === 'shared' ? 'Shared' : null,
        form.bedType ? `${form.bedType.charAt(0).toUpperCase()}${form.bedType.slice(1)} bed` : null,
        form.bathroom === 'attached' ? 'Attached bath' : form.bathroom ? 'Shared bath' : null,
        form.roomFeatures.length > 0 ? form.roomFeatures.slice(0, 2).join(', ') : null,
      ].filter(Boolean).join(' · '),
    },
    {
      label: 'Flatmates',
      step: 4,
      value: form.flatmates.length > 0
        ? `${form.flatmates.length} flatmate${form.flatmates.length > 1 ? 's' : ''} added`
        : 'No flatmates added',
    },
    {
      label: 'Amenities',
      step: 5,
      value: [amenityHighlights || null, form.homeCooked ? 'Home-cooked meals' : null]
        .filter(Boolean).join(' · '),
    },
    {
      label: 'Photos',
      step: 6,
      value: totalPhotos > 0 ? `${totalPhotos} photo${totalPhotos > 1 ? 's' : ''} added` : 'No photos added',
    },
    {
      label: 'Price',
      step: 7,
      value: [
        rate > 0 ? `₹${rate}/night` : null,
        form.weeklyDiscount ? '10% weekly discount' : null,
      ].filter(Boolean).join(' · '),
    },
    {
      label: 'House rules',
      step: 8,
      value: [
        ruleCount > 0 ? `${ruleCount} rule${ruleCount > 1 ? 's' : ''} set` : null,
        form.cancellationPolicy ? `${form.cancellationPolicy.charAt(0).toUpperCase()}${form.cancellationPolicy.slice(1)} cancellation` : null,
        form.checkInTime ? `Check-in ${form.checkInTime}` : null,
      ].filter(Boolean).join(' · '),
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={stSt.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={stSt.title}>Review & publish</Text>
      <Text style={stSt.sub}>Here's what guests will see. Make sure everything looks great!</Text>

      <View style={rvSt.previewCard}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={rvSt.coverPhoto} resizeMode="cover" />
        ) : (
          <View style={rvSt.photoPlaceholder}>
            <Text style={{ fontSize: 40 }}>🏠</Text>
          </View>
        )}

        {tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm }}>
            {tags.map((tag) => (
              <View key={tag} style={rvSt.tag}>
                <Text style={rvSt.tagTxt}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={rvSt.previewTitle} numberOfLines={2}>
          {form.title || 'Your listing title'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {rate > 0 && (
            <Text style={rvSt.price}>
              ₹{rate.toLocaleString('en-IN')}
              <Text style={{ fontSize: 13, ...FONTS.regular, color: COLORS.textSec }}>/night</Text>
            </Text>
          )}
          <View style={rvSt.newBadge}>
            <Text style={rvSt.newTxt}>✨ New listing</Text>
          </View>
        </View>
      </View>

      {SUMMARY_ROWS.map((row) => (
        <View key={row.label} style={rvSt.summaryRow}>
          <View style={{ flex: 1 }}>
            <Text style={rvSt.summaryLabel}>{row.label}</Text>
            <Text style={rvSt.summaryValue} numberOfLines={2}>
              {row.value || '—'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => goToStep(row.step)} style={rvSt.editBtn}>
            <Text style={rvSt.editTxt}>Edit</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={[rvSt.publishBtn, submitting && { opacity: 0.7 }]}
        onPress={handlePublish}
        activeOpacity={0.85}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, ...FONTS.semibold }}>Review & publish</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={rvSt.backBtn}>
        <Text style={{ fontSize: 15, ...FONTS.medium, color: COLORS.textSec }}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const rvSt = StyleSheet.create({
  previewCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  coverPhoto: { width: '100%', height: 140, borderRadius: RADIUS.sm },
  photoPlaceholder: {
    height: 120,
    backgroundColor: COLORS.warm,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagTxt: { fontSize: 11, ...FONTS.medium, color: COLORS.textSec },
  previewTitle: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, marginTop: SPACING.sm, marginBottom: 6 },
  price: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  newBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.accentAlpha },
  newTxt: { fontSize: 11, ...FONTS.semibold, color: COLORS.accent },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  summaryLabel: { fontSize: 13, ...FONTS.semibold, color: COLORS.textSec, marginBottom: 2 },
  summaryValue: { fontSize: 14, color: COLORS.text },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editTxt: { fontSize: 13, ...FONTS.medium, color: COLORS.textSec },
  publishBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  backBtn: { alignItems: 'center', paddingVertical: SPACING.sm, marginBottom: SPACING.lg },
});

// ─── Shared step styles ────────────────────────────────────────────────────────

const stSt = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: 6 },
  sub: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.sm, lineHeight: 20 },
  infoBox: {
    backgroundColor: COLORS.primaryAlpha,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: 8,
    marginBottom: 14,
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ListingEditorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList, 'ListingEditor'>>();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INIT);
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback((u: Partial<FormData>) => setForm((prev) => ({ ...prev, ...u })), []);
  const next = useCallback(() => setStep((s) => Math.min(s + 1, TOTAL_STEPS)), []);
  const back = useCallback(
    () => (step === 0 ? navigation.goBack() : setStep((s) => s - 1)),
    [step, navigation]
  );
  const saveExit = useCallback(() => navigation.goBack(), [navigation]);
  const goToStep = useCallback((s: number) => setStep(s), []);

  const stepProps: StepProps = { form, update, onNext: next, onBack: back };

  const renderStep = () => {
    switch (step) {
      case 0: return <StepWelcome onNext={next} />;
      case 1: return <StepProperty {...stepProps} />;
      case 2: return <StepRoom {...stepProps} />;
      case 3: return <StepTitle {...stepProps} />;
      case 4: return <StepFlatmates {...stepProps} />;
      case 5: return <StepAmenities {...stepProps} />;
      case 6: return <StepPhotos {...stepProps} />;
      case 7: return <StepPrice {...stepProps} />;
      case 8: return <StepRules {...stepProps} />;
      case 9: return (
        <StepReview
          form={form}
          onBack={back}
          goToStep={goToStep}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onSuccess={() => navigation.goBack()}
        />
      );
      default: return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {step > 0 && <EditorHeader onSaveExit={saveExit} />}
      {step > 0 && <ProgressBar step={step} />}
      {renderStep()}
    </SafeAreaView>
  );
}
