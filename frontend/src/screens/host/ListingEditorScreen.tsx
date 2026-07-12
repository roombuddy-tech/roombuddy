import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import GooglePlacesInput from '../../components/forms/GooglePlacesInput';
import { CONFIG } from '../../constants/config';
import { FONTS, RADIUS, SPACING, ThemeColors, ThemeShadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme, useThemeColors } from '../../context/ThemeContext';
import type { HostStackParamList } from '../../navigation/types';
import { createListing, getListing, updateListing } from '../../services/listings';
import { uploadAllPropertyPhotos } from '../../services/properties';

const getDraftKey = (userId: string) => `LISTING_DRAFT_${userId}`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Flatmate {
  id: string;
  name: string;
  age: string;
  occupation: string;
  hobbies: string;
  gender: string;
  hometown: string;
}

interface FormData {
  apartmentType: string;
  floorNumber: string;
  totalFloors: string;
  apartmentName: string;
  locality: string;
  city: string;
  googlePlaceId: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  state: string;
  pincode: string;
  roomType: string;
  bedType: string;
  bathroom: string;

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
  mealTypes: string[];
  mealCost: string;
  mealDescription: string;
  nightlyRate: string;
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
  hostAge: string;
  hostOccupation: string;
  hostHobbies: string;
  hostGender: string;
  blockedDates: Array<{ startDate: string; endDate: string }>;
}

const INIT: FormData = {
  apartmentType: '',
  floorNumber: '',
  totalFloors: '',
  apartmentName: '',
  locality: '',
  city: 'Bengaluru',
  googlePlaceId: '',
  formattedAddress: '',
  latitude: null,
  longitude: null,
  state: '',
  pincode: '',
  roomType: '',
  bedType: '',
  bathroom: '',

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
  mealTypes: [],
  mealCost: '',
  mealDescription: '',
  nightlyRate: '',
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
  hostAge: '',
  hostOccupation: '',
  hostHobbies: '',
  hostGender: '',
  blockedDates: [],
};

const TOTAL_STEPS = 9;

// ─── Constants ────────────────────────────────────────────────────────────────

const APT_TYPES = [
  { value: '1BHK', label: '1 BHK', sub: 'Studio / single room', icon: 'bed-outline' as const },
  { value: '2BHK', label: '2 BHK', sub: 'Two-room flat', icon: 'home-outline' as const },
  { value: '3BHK', label: '3 BHK', sub: 'Spacious apartment', icon: 'home' as const },
  { value: '4BHK+', label: '4 BHK+', sub: 'Large home / villa', icon: 'business' as const },
];

const AMENITY_GROUPS = [
  {
    label: 'Essentials',
    optional: true,
    items: ['WiFi', 'AC', 'Geyser / Hot water', 'Power backup', 'Washing machine', 'Iron', 'Hair dryer'],
  },
  {
    label: 'Kitchen & Food',
    optional: true,
    items: ['Full kitchen access', 'Fridge', 'Microwave', 'Gas stove', 'Water purifier', 'Utensils provided'],
  },
  {
    label: 'Comfort',
    optional: true,
    items: ['TV', 'Sofa / Common area', 'Workspace / Desk', 'Parking (2-wheeler)', 'Parking (4-wheeler)', 'Lift / Elevator'],
  },
  {
    label: 'Safety',
    optional: true,
    items: ['CCTV (common areas)', 'Security guard', 'Fire extinguisher', 'First aid kit', 'Door lock on room'],
  },
];

const AMENITY_ICONS: Record<string, any> = {
  'WiFi': 'wifi-outline',
  'AC': 'snow-outline',
  'Geyser / Hot water': 'water-outline',
  'Power backup': 'battery-charging-outline',
  'Washing machine': 'refresh-circle-outline',
  'Iron': 'shirt-outline',
  'Hair dryer': 'color-wand-outline',
  'Full kitchen access': 'restaurant-outline',
  'Fridge': 'cube-outline',
  'Microwave': 'radio-outline',
  'Gas stove': 'flame-outline',
  'Water purifier': 'filter-outline',
  'Utensils provided': 'cafe-outline',
  'TV': 'tv-outline',
  'Sofa / Common area': 'people-outline',
  'Workspace / Desk': 'desktop-outline',
  'Parking (2-wheeler)': 'bicycle-outline',
  'Parking (4-wheeler)': 'car-outline',
  'Lift / Elevator': 'arrow-up-circle-outline',
  'CCTV (common areas)': 'camera-outline',
  'Security guard': 'shield-checkmark-outline',
  'Fire extinguisher': 'warning-outline',
  'First aid kit': 'medkit-outline',
  'Door lock on room': 'lock-closed-outline',
};

const MEAL_TYPE_OPTIONS = ['Breakfast', 'Lunch', 'Dinner'];

const PHOTO_CATEGORIES = [
  { key: 'bedroom', label: 'Bedroom', icon: '🛏️', required: true },
  { key: 'bathroom', label: 'Bathroom', icon: '🚿', required: true },
  { key: 'kitchen', label: 'Kitchen', icon: '🍳', required: false },
  { key: 'living', label: 'Living / Common area', icon: '🛋️', required: false },
  { key: 'entrance', label: 'Building entrance', icon: '🏢', required: false },
  { key: 'balcony', label: 'Balcony / View', icon: '🌅', required: false },
];

const MIN_STAY_OPTIONS = [
  { value: '1_night', label: '1 Night' },
  { value: '2_nights', label: '2 Nights' },
  { value: '3_nights', label: '3 Nights' },
  { value: '1_week', label: '1 Week' },
  { value: '2_weeks', label: '2 Weeks' },
  { value: '1_month', label: '1 Month' },
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
  const COLORS = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: SPACING.lg, paddingVertical: 12 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const idx = i + 1;
        const bg = idx < step ? COLORS.primary : idx === step ? COLORS.primaryDark : COLORS.border;
        return <View key={idx} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: bg }} />;
      })}
    </View>
  );
}

function EditorHeader({ onSaveExit }: { onSaveExit: () => void }) {
  const COLORS = useThemeColors();
  const hdrSt = useMemo(() => makeHdrStyles(COLORS), [COLORS]);
  return (
    <View style={hdrSt.row}>
      <Text style={hdrSt.brand}>
        Room<Text style={{ color: COLORS.primary }}>Buddy</Text>
      </Text>
      <TouchableOpacity onPress={onSaveExit} style={hdrSt.saveBtn}>
        <Text style={hdrSt.saveTxt}>Save & exit</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeHdrStyles = (COLORS: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  brand: { fontSize: 20, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5 },
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
  update: (u: Partial<FormData> | ((prev: FormData) => Partial<FormData>)) => void;
  onNext: () => void;
  onBack: () => void;
}

function BottomNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  validate,
  isValid = true,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  validate?: () => string | null;
  isValid?: boolean;
}) {
  const COLORS = useThemeColors();
  const bnSt = useMemo(() => makeBnStyles(COLORS), [COLORS]);
  const [touched, setTouched] = useState(false);

  const error = touched && validate ? validate() : null;

  const handleNext = () => {
    if (validate) {
      const err = validate();
      if (err) {
        setTouched(true);
        return;
      }
    }
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
        <TouchableOpacity
          onPress={handleNext}
          style={[bnSt.next, !isValid && { opacity: 0.45 }]}
          activeOpacity={0.85}
        >
          <Text style={bnSt.nextTxt}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeBnStyles = (COLORS: ThemeColors) => StyleSheet.create({
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
  next: { flex: 3, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.pill, backgroundColor: COLORS.primary },
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
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: (color: string) => React.ReactNode;
}) {
  const COLORS = useThemeColors();
  const cpSt = useMemo(() => makeCpStyles(COLORS), [COLORS]);
  const color = selected ? '#fff' : COLORS.textSec;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[cpSt.chip, selected && cpSt.sel]}
    >
      {icon ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon(color)}
          <Text style={[cpSt.lbl, selected && cpSt.lblSel]}>{label}</Text>
        </View>
      ) : (
        <Text style={[cpSt.lbl, selected && cpSt.lblSel]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const makeCpStyles = (COLORS: ThemeColors) => StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
  },
  sel: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  lbl: { fontSize: 13, ...FONTS.semibold, color: COLORS.text },
  lblSel: { color: '#fff' },
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
  const COLORS = useThemeColors();
  const acSt = useMemo(() => makeAcStyles(COLORS), [COLORS]);
  const iconName = AMENITY_ICONS[label] ?? 'ellipse-outline';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[acSt.chip, selected && acSt.sel]}
    >
      <Ionicons name={iconName} size={14} color={selected ? '#fff' : COLORS.primary} style={{ marginRight: 6 }} />
      <Text style={[acSt.lbl, selected && acSt.lblSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeAcStyles = (COLORS: ThemeColors) => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
  },
  sel: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  lbl: { fontSize: 13, ...FONTS.semibold, color: COLORS.text },
  lblSel: { color: '#fff' },
});

function OptionalMark() {
  const COLORS = useThemeColors();
  return <Text style={{ fontSize: 11, color: COLORS.textMut, ...FONTS.regular }}> (optional)</Text>;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  multiline,
  keyboardType,
  optional,
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: any;
  optional?: boolean;
}) {
  const COLORS = useThemeColors();
  const fldSt = useMemo(() => makeFldStyles(COLORS), [COLORS]);
  return (
    <View style={{ marginTop: 16 }}>
      {label ? (
        <Text style={fldSt.label}>
          {label}
          {optional && <OptionalMark />}
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

const makeFldStyles = (COLORS: ThemeColors) => StyleSheet.create({
  label: { fontSize: 14, ...FONTS.bold, color: COLORS.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
});

function SectionLabel({ label, optional }: { label: string; optional?: boolean }) {
  const COLORS = useThemeColors();
  return (
    <Text style={{ fontSize: 15, ...FONTS.bold, color: COLORS.text, marginTop: 16, marginBottom: 8 }}>
      {label}
      {optional && <OptionalMark />}
    </Text>
  );
}

function RuleRow({
  label,
  value,
  onChange,
  noBorder,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  noBorder?: boolean;
}) {
  const COLORS = useThemeColors();
  const rrSt = useMemo(() => makeRrStyles(COLORS), [COLORS]);
  return (
    <View style={[rrSt.row, noBorder && { borderBottomWidth: 0 }]}>
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

const makeRrStyles = (COLORS: ThemeColors) => StyleSheet.create({
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

function parseTimeString(timeStr: string): Date {
  const d = new Date();
  d.setSeconds(0);
  d.setMilliseconds(0);
  if (!timeStr) { d.setHours(12, 0); return d; }
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) { d.setHours(12, 0); return d; }
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'AM' && h === 12) h = 0;
  else if (period === 'PM' && h !== 12) h += 12;
  d.setHours(h, m);
  return d;
}

function formatTimeDate(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m < 10 ? '0' : ''}${m} ${period}`;
}

function TimePicker({
  label,
  value,
  onChange,
  optional,
  placeholder = 'Select time',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  placeholder?: string;
}) {
  const COLORS = useThemeColors();
  const fldSt = useMemo(() => makeFldStyles(COLORS), [COLORS]);
  const tpSt = useMemo(() => makeTpStyles(COLORS), [COLORS]);
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState(() => parseTimeString(value));

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={fldSt.label}>
        {label}
        {optional && <OptionalMark />}
      </Text>
      <TouchableOpacity
        style={tpSt.trigger}
        onPress={() => { setTempDate(parseTimeString(value)); setOpen(true); }}
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
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={{ fontSize: 16, color: COLORS.textSec, ...FONTS.medium }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={tpSt.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => { onChange(formatTimeDate(tempDate)); setOpen(false); }}>
                <Text style={{ fontSize: 16, color: COLORS.primary, ...FONTS.semibold }}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="time"
              display="spinner"
              minuteInterval={30}
              onChange={(_, selectedDate) => { if (selectedDate) setTempDate(selectedDate); }}
              style={{ height: 200 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeTpStyles = (COLORS: ThemeColors) => StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
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
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const wlSt = useMemo(() => makeWlStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={wlSt.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={wlSt.hero}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.chip, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md }}>
          <Ionicons name="home-outline" size={32} color={COLORS.primary} />
        </View>
        <Text style={wlSt.title}>List your spare room</Text>
        <Text style={wlSt.sub}>
          Turn your temporarily empty room into income.{'\n'}Takes just a few minutes.
        </Text>
      </View>

      {[
        { icon: 'create-outline' as const, label: 'Property & room details', desc: 'Address, room type & amenities' },
        { icon: 'people-outline' as const, label: 'Flatmate profiles', desc: 'Who else lives there' },
        { icon: 'camera-outline' as const, label: 'Photos', desc: 'Show off your space' },
        { icon: 'pricetag-outline' as const, label: 'Pricing & availability', desc: 'Set your rate & calendar' },
      ].map((s) => (
        <View key={s.label} style={wlSt.card}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name={s.icon} size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, ...FONTS.semibold, color: COLORS.text }}>{s.label}</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSec, marginTop: 2 }}>{s.desc}</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity style={wlSt.cta} onPress={onNext} activeOpacity={0.85}>
        <Text style={{ color: COLORS.onPrimary, fontSize: 16, ...FONTS.semibold }}>Get started</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeWlStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: SPACING.md },
  hero: { alignItems: 'center', marginBottom: SPACING.xl },
  title: { fontSize: 28, ...FONTS.bold, color: COLORS.primary, textAlign: 'center', marginBottom: SPACING.sm },
  sub: { fontSize: 15, color: COLORS.textSec, textAlign: 'center', lineHeight: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    ...SHADOW.md,
  },
  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
});

// ─── Step 1: Your Property ────────────────────────────────────────────────────

function StepProperty({ form, update, onNext, onBack }: StepProps) {
  const COLORS = useThemeColors();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const prpSt = useMemo(() => makePrpStyles(COLORS), [COLORS]);
  const isValid =
    !!form.apartmentType &&
    form.floorNumber.trim().length > 0 &&
    form.apartmentName.trim().length > 0 &&
    form.locality.trim().length > 0 &&
    form.city.trim().length > 0;

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
        <Text style={stSt.title}>Your Property</Text>
        <Text style={stSt.sub}>Share your apartment details so guests know what to expect.</Text>

        <SectionLabel label="Apartment type" />
        <View style={prpSt.aptGrid}>
          {APT_TYPES.map((t) => {
            const sel = form.apartmentType === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                style={[prpSt.aptCard, sel && prpSt.aptCardSel]}
                onPress={() => update({ apartmentType: t.value })}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={t.icon}
                  size={28}
                  color={sel ? COLORS.primary : COLORS.textSec}
                  style={{ marginBottom: 6 }}
                />
                <Text style={[prpSt.aptLabel, sel && { color: COLORS.primary }]}>{t.label}</Text>
                <Text style={prpSt.aptSub}>{t.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field
          label="Floor number"
          placeholder="e.g. 3"
          value={form.floorNumber}
          onChange={(v) => update({ floorNumber: v.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
        />
        <Field
          label="Society / Apartment name"
          placeholder="e.g. Prestige Shantiniketan"
          value={form.apartmentName}
          onChange={(v) => update({ apartmentName: v })}
        />
        <SectionLabel label="Location" />
        <GooglePlacesInput
          value={form.formattedAddress || form.locality}
          placeholder="Search for your area, locality..."
          onSelect={(place) => {
            update({
              locality: place.addressLine1 || place.description,
              city: place.city || form.city,
              state: place.state,
              googlePlaceId: place.placeId,
              formattedAddress: place.description,
              latitude: place.lat,
              longitude: place.lng,
              pincode: place.pincode,
            });
          }}
        />
        <Field
          label="City"
          placeholder="City"
          value={form.city}
          onChange={(v) => update({ city: v })}
        />
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <View style={{ flex: 1 }}>
            <Field
              label="State"
              placeholder="Auto-filled"
              value={form.state}
              onChange={(v) => update({ state: v })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Pincode"
              placeholder="Auto-filled"
              value={form.pincode}
              onChange={(v) => update({ pincode: v.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={stSt.infoBox}>
          <Ionicons name="information-circle" size={16} color={COLORS.primary} style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={{ fontSize: 12, color: COLORS.primaryDark, lineHeight: 18, flex: 1 }}>
            Your full address is only shared with guests after a confirmed booking. On the map, guests see only the neighbourhood.
          </Text>
        </View>

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} isValid={isValid} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makePrpStyles = (COLORS: ThemeColors) => StyleSheet.create({
  aptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  aptCard: {
    width: '47%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  aptCardSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  aptLabel: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  aptLabelSel: { color: COLORS.primary },
  aptSub: { fontSize: 11, color: COLORS.textSec, textAlign: 'center' },
});

// ─── Step 2: Room Details ─────────────────────────────────────────────────────

function StepRoom({ form, update, onNext, onBack }: StepProps) {
  const COLORS = useThemeColors();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const rdSt = useMemo(() => makeRdStyles(COLORS), [COLORS]);
  const toggleFeature = (f: string) => {
    update((prev) => ({
      roomFeatures: prev.roomFeatures.includes(f)
        ? prev.roomFeatures.filter((x) => x !== f)
        : [...prev.roomFeatures, f],
    }));
  };

  const isValid = !!form.roomType && !!form.bedType && !!form.bathroom;

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
        <Text style={stSt.title}>Room Details</Text>
        <Text style={stSt.sub}>Describe the room you're renting out.</Text>

        <SectionLabel label="Room type" />
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm }}>
          <TouchableOpacity
            style={[rdSt.typeCard, form.roomType === 'private' && rdSt.typeCardSel]}
            onPress={() => update({ roomType: 'private' })}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="door-closed-lock" size={24} color={COLORS.text} style={{ marginBottom: 4 }} />
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
            <MaterialCommunityIcons name="bunk-bed-outline" size={24} color={COLORS.text} style={{ marginBottom: 4 }} />
            <Text style={[rdSt.typeTitle, form.roomType === 'shared' && { color: COLORS.primary }]}>
              Shared room
            </Text>
            <Text style={rdSt.typeSub}>Guest shares the room with others</Text>
          </TouchableOpacity>
        </View>

        <SectionLabel label="Bed type" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {([
            { label: 'Single', icon: 'bed-single-outline' },
            { label: 'Double', icon: 'bed-double-outline' },
            { label: 'Queen', icon: 'bed-queen-outline' },
            { label: 'King', icon: 'bed-king-outline' },
            { label: 'Mattress', icon: 'bed-outline' },
          ] as const).map((b) => (
            <Chip
              key={b.label}
              label={b.label}
              selected={form.bedType === b.label.toLowerCase()}
              onPress={() => update({ bedType: b.label.toLowerCase() })}
              icon={(c) => <MaterialCommunityIcons name={b.icon} size={16} color={c} />}
            />
          ))}
        </View>

        <SectionLabel label="Bathroom" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {([
            { value: 'attached', label: 'Attached', icon: 'shower-head' },
            { value: 'shared', label: 'Common / Shared', icon: 'toilet' },
          ] as const).map((b) => (
            <Chip
              key={b.value}
              label={b.label}
              selected={form.bathroom === b.value}
              onPress={() => update({ bathroom: b.value })}
              icon={(c) => <MaterialCommunityIcons name={b.icon} size={16} color={c} />}
            />
          ))}
        </View>

        <SectionLabel label="Room has" optional />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {([
            { label: 'Door lock', icon: 'lock-outline' },
            { label: 'Window', icon: 'window-open-variant' },
            { label: 'Balcony', icon: 'balcony' },
            { label: 'Wardrobe', icon: 'wardrobe-outline' },
            { label: 'Study table', icon: 'desk' },
            { label: 'Mirror', icon: 'mirror' },
            { label: 'Bookshelf', icon: 'bookshelf' },
            { label: 'Curtains', icon: 'curtains' },
          ] as const).map((f) => (
            <Chip
              key={f.label}
              label={f.label}
              selected={form.roomFeatures.includes(f.label)}
              onPress={() => toggleFeature(f.label)}
              icon={(c) => <MaterialCommunityIcons name={f.icon} size={16} color={c} />}
            />
          ))}
        </View>

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} isValid={isValid} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeRdStyles = (COLORS: ThemeColors) => StyleSheet.create({
  typeCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: COLORS.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  typeCardSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha },
  typeTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  typeSub: { fontSize: 12, color: COLORS.textSec, lineHeight: 16 },
});

// ─── Step 3: Title & Description ──────────────────────────────────────────────

function StepTitle({ form, update, onNext, onBack }: StepProps) {
  const COLORS = useThemeColors();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const LANDMARKS = ['Metro station', 'Bus stop', 'Tech park', 'Mall', 'Hospital', 'Restaurant hub'];

  const toggleLandmark = (l: string) => {
    update((prev) => ({ nearbyLandmarks: prev.nearbyLandmarks.includes(l) ? [] : [l] }));
  };

  const isValid = form.title.trim().length > 0 && form.description.trim().length > 0;

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
        <Text style={stSt.title}>Title & Description</Text>
        <Text style={stSt.sub}>This is the first thing guests see. Make it count!</Text>

        <Field
          label="Listing title"
          placeholder='Cozy private room in 2BHK'
          value={form.title}
          onChange={(v) => update({ title: v })}
        />
        <Text style={stSt.hint}>Keep it short and specific, like the example above.</Text>

        <Field
          label="Description"
          placeholder="Tell guests what makes your place special — the vibe, what's nearby, and what your flatmates are like."
          value={form.description}
          onChange={(v) => update({ description: v })}
          multiline
        />
        <Text style={stSt.hint}>A few honest lines help guests feel confident about booking.</Text>

        <SectionLabel label="Nearby landmarks" optional />
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

        {form.nearbyLandmarks.length > 0 && (
          <Field
            label="Walking time to nearest landmark (minutes)"
            placeholder="e.g. 5"
            value={form.distanceToLandmark}
            onChange={(v) => update({ distanceToLandmark: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
          />
        )}

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} isValid={isValid} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 4: Flatmates ────────────────────────────────────────────────────────

function StepFlatmates({ form, update, onNext, onBack }: StepProps) {
  const { user } = useAuth();
  const COLORS = useThemeColors();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const fmSt = useMemo(() => makeFmStyles(COLORS), [COLORS]);
  const [modalVisible, setModalVisible] = useState(false);
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', age: '', occupation: '', hobbies: '', gender: '', hometown: '' });

  const profileGender: string = user?.gender || user?.profile?.gender || '';
  const [hostDraft, setHostDraft] = useState({
    age: form.hostAge,
    occupation: form.hostOccupation,
    hobbies: form.hostHobbies,
    gender: form.hostGender || profileGender,
  });

  useEffect(() => {
    if (!form.hostGender && profileGender) {
      update({ hostGender: profileGender });
    }
  }, [profileGender]);

  const displayName: string =
    user?.display_name || user?.first_name || user?.profile?.first_name || 'You';
  const city: string = user?.city || user?.profile?.city || form.city;

  const saveFlatmate = () => {
    if (!draft.name.trim()) return;
    if (editingId) {
      update({
        flatmates: form.flatmates.map((f) =>
          f.id === editingId ? { ...f, ...draft } : f
        ),
      });
    } else {
      const flatmate: Flatmate = {
        id: Date.now().toString(),
        name: draft.name,
        age: draft.age,
        occupation: draft.occupation,
        hobbies: draft.hobbies,
        gender: draft.gender,
        hometown: draft.hometown,
      };
      update({ flatmates: [...form.flatmates, flatmate] });
    }
    setDraft({ name: '', age: '', occupation: '', hobbies: '', gender: '', hometown: '' });
    setEditingId(null);
    setModalVisible(false);
  };

  const editFlatmate = (fm: Flatmate) => {
    setEditingId(fm.id);
    setDraft({ name: fm.name, age: fm.age, occupation: fm.occupation, hobbies: fm.hobbies, gender: fm.gender, hometown: fm.hometown });
    setModalVisible(true);
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

  const GENDER_OPTIONS = ['Male', 'Female', 'Others', 'Prefer not to say'];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={stSt.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={stSt.title}>Your Flatmates</Text>
      <Text style={[stSt.sub, { marginBottom: SPACING.md }]}>Let guests know who they'll be sharing the space with.</Text>

      {/* Host card — tappable to add occupation/hobbies/gender */}
      <TouchableOpacity style={fmSt.card} onPress={() => setHostModalOpen(true)} activeOpacity={0.7}>
        <View style={fmSt.avatar}>
          <Text style={fmSt.avatarTxt}>{initials(displayName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fmSt.name}>{displayName}{form.hostAge ? `, ${form.hostAge}` : ''}</Text>
          {form.hostGender ? (
            <Text style={fmSt.detail}>
              {form.hostGender.charAt(0).toUpperCase() + form.hostGender.slice(1)}
            </Text>
          ) : null}
          {form.hostOccupation || form.hostHobbies ? (
            <Text style={fmSt.detail} numberOfLines={1}>
              {[form.hostOccupation, form.hostHobbies].filter(Boolean).join(' · ')}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: COLORS.textMut, marginTop: 2 }}>
              Tap to add occupation & hobbies
            </Text>
          )}
          {city ? <Text style={fmSt.detail}>{city}</Text> : null}
        </View>
        <Ionicons name="pencil-outline" size={16} color={COLORS.textMut} />
      </TouchableOpacity>

      {form.flatmates.map((fm) => (
        <TouchableOpacity key={fm.id} style={fmSt.card} onPress={() => editFlatmate(fm)} activeOpacity={0.7}>
          <View style={fmSt.avatar}>
            <Text style={fmSt.avatarTxt}>{initials(fm.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={fmSt.name}>
              {fm.name}
              {fm.age ? `, ${fm.age}` : ''}
            </Text>
            {fm.gender ? (
              <Text style={fmSt.detail}>
                {fm.gender.charAt(0).toUpperCase() + fm.gender.slice(1)}
              </Text>
            ) : null}
            {fm.occupation || fm.hobbies ? (
              <Text style={fmSt.detail} numberOfLines={1}>
                {[fm.occupation, fm.hobbies].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {fm.hometown ? <Text style={fmSt.detail}>{fm.hometown}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => removeFlatmate(fm.id)} style={{ padding: 6 }}>
            <Ionicons name="close-circle-outline" size={20} color={COLORS.textMut} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={fmSt.addCard}
        onPress={() => { setEditingId(null); setDraft({ name: '', age: '', occupation: '', hobbies: '', gender: '', hometown: '' }); setModalVisible(true); }}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={24} color={COLORS.primary} />
        <Text style={fmSt.addTxt}>Add flatmate</Text>
      </TouchableOpacity>

      <SectionLabel label="Guest gender preference" optional />
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

      {/* Host profile modal */}
      <Modal visible={hostModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={fmSt.modalOverlay}
            activeOpacity={1}
            onPress={() => setHostModalOpen(false)}
          >
            <View style={fmSt.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={fmSt.dragHandleWrap}><View style={fmSt.dragHandle} /></View>
              <View style={fmSt.modalHeader}>
                <Text style={fmSt.modalTitle}>Your profile</Text>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Field
                  label="Age"
                  placeholder="e.g. 26"
                  value={hostDraft.age}
                  onChange={(v) => { const n = parseInt(v, 10); setHostDraft((d) => ({ ...d, age: !v ? '' : (n > 99 ? '99' : v.replace(/[^0-9]/g, '')) })); }}
                  keyboardType="number-pad"
                  optional
                />
                <SectionLabel label="Gender" optional />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.sm }}>
                  {GENDER_OPTIONS.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      selected={hostDraft.gender === g.toLowerCase()}
                      onPress={() => setHostDraft((d) => ({ ...d, gender: g.toLowerCase() }))}
                    />
                  ))}
                </View>
                <Field
                  label="Occupation"
                  placeholder="e.g. Software Engineer"
                  value={hostDraft.occupation}
                  onChange={(v) => setHostDraft((d) => ({ ...d, occupation: v }))}
                  optional
                />
                <Field
                  label="Hobbies"
                  placeholder="e.g. Reading, Cooking, Cricket"
                  value={hostDraft.hobbies}
                  onChange={(v) => setHostDraft((d) => ({ ...d, hobbies: v }))}
                  optional
                />
                <TouchableOpacity
                  style={fmSt.saveBtn}
                  onPress={() => {
                    update({
                      hostAge: hostDraft.age,
                      hostOccupation: hostDraft.occupation,
                      hostHobbies: hostDraft.hobbies,
                      hostGender: hostDraft.gender,
                    });
                    setHostModalOpen(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#fff', fontSize: 15, ...FONTS.semibold }}>Save</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add flatmate modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={fmSt.modalOverlay}
            activeOpacity={1}
            onPress={() => { setEditingId(null); setDraft({ name: '', age: '', occupation: '', hobbies: '', gender: '', hometown: '' }); setModalVisible(false); }}
          >
            <View style={fmSt.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={fmSt.dragHandleWrap}><View style={fmSt.dragHandle} /></View>
              <View style={fmSt.modalHeader}>
                <Text style={fmSt.modalTitle}>{editingId ? 'Edit flatmate' : 'Add flatmate'}</Text>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Field
                  label="Name"
                  placeholder="e.g. Arjun S."
                  value={draft.name}
                  onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                />
                <Field
                  label="Age"
                  placeholder="e.g. 26"
                  value={draft.age}
                  onChange={(v) => { const n = parseInt(v, 10); setDraft((d) => ({ ...d, age: !v ? '' : (n > 99 ? '99' : v.replace(/[^0-9]/g, '')) })); }}
                  keyboardType="number-pad"
                  optional
                />
                <SectionLabel label="Gender" optional />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.sm }}>
                  {GENDER_OPTIONS.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      selected={draft.gender === g.toLowerCase()}
                      onPress={() => setDraft((d) => ({ ...d, gender: g.toLowerCase() }))}
                    />
                  ))}
                </View>
                <Field
                  label="Occupation"
                  placeholder="e.g. SE at Google"
                  value={draft.occupation}
                  onChange={(v) => setDraft((d) => ({ ...d, occupation: v }))}
                  optional
                />
                <Field
                  label="Hobbies"
                  placeholder="e.g. Cricket, Cooking"
                  value={draft.hobbies}
                  onChange={(v) => setDraft((d) => ({ ...d, hobbies: v }))}
                  optional
                />
                <View style={{ marginTop: 16, marginBottom: SPACING.md, zIndex: 10 }}>
                  <Text style={{ fontSize: 14, ...FONTS.bold, color: COLORS.text, marginBottom: 8 }}>
                    Hometown <Text style={{ fontSize: 12, color: COLORS.textMut, ...FONTS.regular }}>(optional)</Text>
                  </Text>
                  <GooglePlacesInput
                    value={draft.hometown}
                    placeholder="e.g. Jaipur"
                    onSelect={(place) => setDraft((d) => ({ ...d, hometown: place.city || place.description }))}
                    onChangeText={(text) => setDraft((d) => ({ ...d, hometown: text }))}
                  />
                </View>
                <TouchableOpacity
                  style={fmSt.saveBtn}
                  onPress={saveFlatmate}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#fff', fontSize: 15, ...FONTS.semibold }}>Save</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const makeFmStyles = (COLORS: ThemeColors) => StyleSheet.create({
  banner: {
    backgroundColor: '#FFF7ED',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  bannerTxt: { fontSize: 13, color: COLORS.primaryDark },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarTxt: { fontSize: 15, ...FONTS.bold, color: COLORS.primary },
  name: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  detail: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: SPACING.lg,
    gap: 6,
  },
  addTxt: { fontSize: 14, ...FONTS.medium, color: COLORS.primary },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  dragHandleWrap: { alignItems: 'center' as const, paddingTop: 6, paddingBottom: 2 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
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
  const COLORS = useThemeColors();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const amSt = useMemo(() => makeAmStyles(COLORS), [COLORS]);
  const toggleAmenity = (a: string) => {
    update((prev) => ({
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  };

  const toggleMealType = (m: string) => {
    update((prev) => ({
      mealTypes: prev.mealTypes.includes(m)
        ? prev.mealTypes.filter((x) => x !== m)
        : [...prev.mealTypes, m],
    }));
  };

  const requiredGroups = AMENITY_GROUPS.filter((g) => !g.optional);
  const isValid = requiredGroups.every((group) =>
    group.items.some((item) => form.amenities.includes(item))
  );

  const validate = (): string | null => {
    for (const group of requiredGroups) {
      const hasOne = group.items.some((item) => form.amenities.includes(item));
      if (!hasOne) return `Please select at least one item from "${group.label}"`;
    }
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={stSt.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={stSt.title}>Amenities & Food</Text>
      <Text style={stSt.sub}>What's included in the stay? Guests see this before booking.</Text>

      {AMENITY_GROUPS.map((group) => (
        <View key={group.label}>
          <SectionLabel label={group.label} optional={group.optional} />
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

      <SectionLabel label="Food options for guests" optional />
      <View style={amSt.foodCard}>
        <RuleRow
          label="Guests can use the kitchen"
          value={form.kitchenAccess}
          onChange={(v) => update({ kitchenAccess: v })}
        />
        <RuleRow
          label="I can provide home-cooked meals (extra charge)"
          value={form.homeCooked}
          onChange={(v) => update({ homeCooked: v })}
          noBorder
        />
      </View>

      {form.homeCooked && (
        <View style={amSt.mealBox}>
          <SectionLabel label="Meal types offered" optional />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MEAL_TYPE_OPTIONS.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={form.mealTypes.includes(m)}
                onPress={() => toggleMealType(m)}
              />
            ))}
          </View>
          <Field
            label="Describe the meals"
            placeholder="e.g. South Indian home cooking, vegetarian friendly..."
            value={form.mealDescription}
            onChange={(v) => update({ mealDescription: v })}
            multiline
            optional
          />
        </View>
      )}

      <BottomNav onBack={onBack} onNext={onNext} validate={validate} isValid={isValid} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeAmStyles = (COLORS: ThemeColors) => StyleSheet.create({
  foodCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  mealBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
});

// ─── Step 6: Photos ───────────────────────────────────────────────────────────

const ALL_PHOTO_CATEGORIES = [
  ...PHOTO_CATEGORIES,
  { key: 'other', label: 'Other', icon: '📷', required: false },
];

function StepPhotos({ form, update, onNext, onBack }: StepProps) {
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const phSt = useMemo(() => makePhStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const [loading, setLoading] = useState<string | null>(null);

  const addPhotos = async (category: string, useCamera: boolean) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please allow camera access in Settings to take photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      setLoading(category);
      try {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
        if (!result.canceled) {
          const uris = result.assets.map((a) => a.uri);
          update({ photos: { ...form.photos, [category]: [...(form.photos[category] ?? []), ...uris] } });
        }
      } finally {
        setLoading(null);
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please allow photo access in Settings to add photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      setLoading(category);
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'] as any,
          allowsMultipleSelection: true,
          quality: 0.85,
        });
        if (!result.canceled) {
          const uris = result.assets.map((a) => a.uri);
          update({ photos: { ...form.photos, [category]: [...(form.photos[category] ?? []), ...uris] } });
        }
      } finally {
        setLoading(null);
      }
    }
  };

  const openSourcePicker = (category: string) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Add photos',
          options: ['Cancel', 'Take a photo', 'Choose from library'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) addPhotos(category, true);
          else if (idx === 2) addPhotos(category, false);
        }
      );
    } else {
      Alert.alert(
        'Add photos',
        undefined,
        [
          { text: 'Take a photo', onPress: () => addPhotos(category, true) },
          { text: 'Choose from library', onPress: () => addPhotos(category, false) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const removePhoto = (category: string, index: number) => {
    const updated = (form.photos[category] ?? []).filter((_, i) => i !== index);
    update({ photos: { ...form.photos, [category]: updated } });
  };

  const isValid = (form.photos.bedroom?.length ?? 0) > 0 && (form.photos.bathroom?.length ?? 0) > 0;

  const validate = (): string | null => {
    if (!form.photos.bedroom?.length) return 'Please add at least 1 bedroom photo';
    if (!form.photos.bathroom?.length) return 'Please add at least 1 bathroom photo';
    return null;
  };

  const totalPhotos = Object.values(form.photos).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={stSt.content} showsVerticalScrollIndicator={false}>
        <Text style={stSt.title}>Photos</Text>

        <Text style={[stSt.sub, { marginBottom: SPACING.md }]}>
          Add more photos to get more bookings
        </Text>

        {ALL_PHOTO_CATEGORIES.map((cat) => {
          const photos = form.photos[cat.key] ?? [];
          const isLoading = loading === cat.key;
          const hasPhotos = photos.length > 0;

          return (
            <View key={cat.key} style={[phSt.categoryCard, hasPhotos && phSt.categoryCardFilled]}>
              {/* Row header */}
              <View style={phSt.categoryHeader}>
                <Text style={phSt.categoryName}>{cat.label}</Text>
                {cat.required && !hasPhotos && (
                  <View style={phSt.requiredBadge}>
                    <Text style={phSt.requiredTxt}>Required</Text>
                  </View>
                )}
                {hasPhotos && (
                  <View style={phSt.doneBadge}>
                    <Ionicons name="checkmark" size={11} color={COLORS.primary} />
                    <Text style={phSt.doneTxt}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={[phSt.addBtn, isLoading && { opacity: 0.5 }]}
                  onPress={() => openSourcePicker(cat.key)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : <Ionicons name="add" size={18} color="#fff" />
                  }
                </TouchableOpacity>
              </View>

              {/* Photos strip */}
              {hasPhotos && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ overflow: 'visible' }}
                  contentContainerStyle={phSt.thumbStrip}
                >
                  {photos.map((uri, idx) => (
                    <View key={`${cat.key}-${idx}`} style={phSt.thumbWrap}>
                      <Image source={{ uri }} style={phSt.thumbImg} resizeMode="cover" />
                      {idx === 0 && (
                        <View style={phSt.coverBadge}>
                          <Text style={phSt.coverBadgeTxt}>Cover</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={phSt.removeBtn}
                        onPress={() => removePhoto(cat.key, idx)}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Empty prompt */}
              {!hasPhotos && (
                <TouchableOpacity
                  style={phSt.emptyPrompt}
                  onPress={() => openSourcePicker(cat.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={phSt.emptyPromptTxt}>Tap to add photos</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} isValid={isValid} />
      </ScrollView>
  );
}

const makePhStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  tipBox: { backgroundColor: COLORS.raised, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.md },
  tipTxt: { fontSize: 12, color: COLORS.primaryDark, lineHeight: 18 },

  categoryCard: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  categoryCardFilled: { borderColor: COLORS.primary },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 8 },
  categoryIcon: { fontSize: 18 },
  categoryName: { fontSize: 16, ...FONTS.bold, color: COLORS.text },
  requiredBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha },
  requiredTxt: { fontSize: 10, ...FONTS.semibold, color: COLORS.primary },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha },
  doneTxt: { fontSize: 10, ...FONTS.semibold, color: COLORS.primary },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  thumbStrip: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, paddingTop: 8, gap: 12, flexDirection: 'row' },
  thumbWrap: { position: 'relative', overflow: 'visible' },
  thumbImg: { width: 110, height: 82, borderRadius: RADIUS.sm },
  coverBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  coverBadgeTxt: { fontSize: 10, color: '#fff', ...FONTS.semibold },
  removeBtn: { position: 'absolute', top: -7, right: -7, backgroundColor: 'rgba(30,30,30,0.7)', borderRadius: 12 },

  emptyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: 24,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  emptyPromptTxt: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },

});

// ─── Step 7: Set Your Price ───────────────────────────────────────────────────

function StepPrice({ form, update, onNext, onBack }: StepProps) {
  const COLORS = useThemeColors();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const fldSt = useMemo(() => makeFldStyles(COLORS), [COLORS]);
  const prSt = useMemo(() => makePrStyles(COLORS), [COLORS]);
  const [rateFocused, setRateFocused] = useState(false);
  const rate = parseInt(form.nightlyRate, 10) || 0;
  const mealCost = form.homeCooked ? (parseInt(form.mealCost, 10) || 0) : 0;

  const isValid = rate > 0 && (!form.homeCooked || parseInt(form.mealCost, 10) > 0);

  const validate = (): string | null => {
    if (!form.nightlyRate || parseInt(form.nightlyRate, 10) < 1)
      return 'Please set your nightly rate to continue';
    if (form.homeCooked && (!form.mealCost || parseInt(form.mealCost, 10) < 1))
      return 'Please enter the meal cost per day';
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
        <Text style={stSt.title}>Set Your Price</Text>
        <Text style={stSt.sub}>Set your nightly rate. We'll show you what guests pay and what you earn.</Text>

        <Text style={[fldSt.label, { textAlign: 'center', marginBottom: SPACING.sm }]}>Your nightly rate</Text>
        <View style={prSt.rateRow}>
          <Text style={prSt.rupee}>₹</Text>
          <TextInput
            style={prSt.rateInput}
            value={form.nightlyRate}
            onChangeText={(v) => update({ nightlyRate: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder={rateFocused ? '' : '850'}
            placeholderTextColor={COLORS.textMut}
            onFocus={() => setRateFocused(true)}
            onBlur={() => setRateFocused(false)}
          />
          <Text style={prSt.perNight}>per night</Text>
        </View>

        {form.homeCooked && (
          <View style={{ marginBottom: SPACING.md }}>
            <Field
              label="Meal cost per day"
              placeholder="e.g. 200"
              value={form.mealCost}
              onChange={(v) => update({ mealCost: v.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
            />
            <Text style={{ fontSize: 12, color: COLORS.textMut, marginTop: 4 }}>
              Charged separately from the room rate.
            </Text>
          </View>
        )}

        {rate > 0 && (
          <View style={prSt.breakdownBox}>
            <Text style={prSt.breakdownTitle}>What guests see</Text>
            <PriceRow label="Room rate" value={`₹${rate}/night`} />
            {mealCost > 0 && <PriceRow label="Meals (per day)" value={`₹${mealCost}`} />}
            <View style={prSt.divider} />
            <Text style={{ fontSize: 12, color: COLORS.textMut, marginTop: 4, lineHeight: 18 }}>
              Guests pay you directly for rent, deposit and meals. RoomBuddy charges a flat ₹{CONFIG.BOOKING_PLATFORM_FEE} platform fee to the guest at the time of booking — you receive 100% of your listed price.
            </Text>
          </View>
        )}

        <SectionLabel label="Minimum stay" />
        <View style={prSt.tooltipRow}>
          <Ionicons name="information-circle-outline" size={15} color={COLORS.textMut} />
          <Text style={prSt.tooltipText}>
            Guests must book at least this many nights. Shorter bookings won't be allowed.
          </Text>
        </View>
        <View style={prSt.minStayGrid}>
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

        <BottomNav onBack={onBack} onNext={onNext} validate={validate} isValid={isValid} />
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
  const COLORS = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 14, color: muted ? COLORS.textMut : COLORS.textSec, ...(bold ? FONTS.semibold : FONTS.regular) }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: muted ? COLORS.textMut : COLORS.text, ...(bold ? FONTS.bold : FONTS.regular) }}>
        {value}
      </Text>
    </View>
  );
}

const makePrStyles = (COLORS: ThemeColors) => StyleSheet.create({
  rateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.lg, gap: 4,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  rupee: { fontSize: 34, ...FONTS.bold, color: COLORS.primary, alignSelf: 'flex-start', paddingTop: 8 },
  rateInput: { fontSize: 52, ...FONTS.extrabold, color: COLORS.primary, minWidth: 90, textAlign: 'center' },
  perNight: { fontSize: 14, color: COLORS.textSec, alignSelf: 'flex-end', paddingBottom: 12 },
  breakdownBox: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  breakdownTitle: { fontSize: 13, ...FONTS.semibold, color: COLORS.textSec, marginBottom: 8 },
  earningsBox: { backgroundColor: 'rgba(34,197,94,0.07)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  earningTitle: { fontSize: 13, ...FONTS.semibold, color: '#16A34A', marginBottom: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  tooltipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: SPACING.sm, paddingHorizontal: 2 },
  tooltipText: { flex: 1, fontSize: 12, color: COLORS.textMut, lineHeight: 17 },
  minStayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  minStayBtn: { width: '31%', paddingVertical: 13, alignItems: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  minStayBtnSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  minStayTxt: { fontSize: 13, ...FONTS.semibold, color: COLORS.text },
  minStayTxtSel: { color: '#fff', ...FONTS.semibold },
});

// ─── Step 8: House Rules ──────────────────────────────────────────────────────

function StepRules({ form, update, onNext, onBack }: StepProps) {
  const COLORS = useThemeColors();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const isValid = !!form.checkInTime && !!form.checkOutTime;

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
        <Text style={stSt.title}>House Rules</Text>
        <Text style={stSt.sub}>Set clear expectations for your guests.</Text>

        <Text style={{ fontSize: 15, ...FONTS.bold, color: COLORS.text, marginTop: SPACING.sm, marginBottom: SPACING.sm }}>
          Common rules
        </Text>

        <View style={stSt.rulesCard}>
          <RuleRow label="No smoking inside the apartment" value={form.noSmoking} onChange={(v) => update({ noSmoking: v })} />
          <RuleRow label="No loud music after 10 PM" value={form.noLoudMusic} onChange={(v) => update({ noLoudMusic: v })} />
          <RuleRow label="No pets allowed" value={form.noPets} onChange={(v) => update({ noPets: v })} />
          <RuleRow label="No parties or events" value={form.noParties} onChange={(v) => update({ noParties: v })} />
          <RuleRow label="Guests must remove shoes indoors" value={form.shoesOff} onChange={(v) => update({ shoesOff: v })} />
          <RuleRow label="Keep kitchen clean after use" value={form.kitchenClean} onChange={(v) => update({ kitchenClean: v })} />
          <RuleRow label="No alcohol in common areas" value={form.noAlcohol} onChange={(v) => update({ noAlcohol: v })} />
          <RuleRow label="Lock the door when leaving" value={form.lockDoor} onChange={(v) => update({ lockDoor: v })} noBorder />
        </View>

        <View style={{ marginTop: SPACING.lg }} />
        <TimePicker
          label="Check-in time"
          value={form.checkInTime}
          onChange={(v) => update({ checkInTime: v })}
          placeholder="e.g. 2:00 PM"
        />
        <TimePicker
          label="Check-out time"
          value={form.checkOutTime}
          onChange={(v) => update({ checkOutTime: v })}
          placeholder="e.g. 11:00 AM"
        />

        <Field
          label="Custom rules"
          placeholder="e.g. Please don't use the washing machine after 9 PM..."
          value={form.customRules}
          onChange={(v) => update({ customRules: v })}
          multiline
          optional
        />

        <BottomNav onBack={onBack} onNext={onNext} nextLabel="Review & list" validate={validate} isValid={isValid} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


// ─── Step 9: Review & Publish ─────────────────────────────────────────────────

function StepReview({
  form,
  onBack,
  goToStep,
  submitting,
  setSubmitting,
  onSuccess,
  navigation,
  isEditMode = false,
  listingId,
  draftKey,
}: {
  form: FormData;
  onBack: () => void;
  goToStep: (s: number) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onSuccess: () => void;
  navigation: NativeStackNavigationProp<HostStackParamList, 'ListingEditor'>;
  isEditMode?: boolean;
  listingId?: string;
  draftKey: string | null;
}) {
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const stSt = useMemo(() => makeStStyles(COLORS), [COLORS]);
  const rvSt = useMemo(() => makeRvStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const rate = parseInt(form.nightlyRate, 10) || 0;
  const amenityHighlights = form.amenities.slice(0, 3).join(', ');
  const ruleCount = [
    form.noSmoking, form.noLoudMusic, form.noPets, form.noParties,
    form.shoesOff, form.kitchenClean, form.noAlcohol, form.lockDoor,
  ].filter(Boolean).length;
  const totalPhotos = Object.values(form.photos).reduce((s, a) => s + a.length, 0);

  const handlePublish = () => {
    if (isEditMode) {
      Alert.alert(
        'Confirm update',
        'Save your changes to this listing?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Update', onPress: doPublish },
        ]
      );
    } else {
      Alert.alert(
        'Publish listing',
        'Your listing will be available for booking in a few hours.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Publish', onPress: doPublish },
        ]
      );
    }
  };

  const doPublish = async () => {
    setSubmitting(true);
    setUploadProgress(null);
    try {
      let propertyId: string | null = null;

      if (isEditMode && listingId) {
        const result = await updateListing(listingId, form);
        propertyId = result.property_id ?? null;
      } else {
        const result = await createListing(form);
        propertyId = result.property_id ?? null;
        if (draftKey) await AsyncStorage.removeItem(draftKey);
      }

      // Upload only newly added local photos (skip existing S3 URLs)
      const newPhotoCount = Object.values(form.photos)
        .reduce((s, arr) => s + arr.filter(u => !u.startsWith('http')).length, 0);
      if (propertyId && newPhotoCount > 0) {
        setUploadProgress({ done: 0, total: newPhotoCount });
        const { uploaded, failed } = await uploadAllPropertyPhotos(
          propertyId,
          form.photos,
          (done, total) => setUploadProgress({ done, total }),
        );
        setUploadProgress(null);

        if (failed > 0 && uploaded === 0) {
          Alert.alert(
            isEditMode ? 'Updated' : 'Listing published!',
            `Your listing was saved, but all ${failed} photo${failed > 1 ? 's' : ''} failed to upload. You can add them later via Edit listing.`,
            [{ text: 'OK', onPress: onSuccess }],
          );
          return;
        }
        if (failed > 0) {
          Alert.alert(
            isEditMode ? 'Updated' : 'Listing published!',
            `${uploaded} photo${uploaded > 1 ? 's' : ''} uploaded. ${failed} failed — you can add them later via Edit listing.`,
            [{ text: 'OK', onPress: onSuccess }],
          );
          return;
        }
      }

      Alert.alert(
        isEditMode ? 'Updated!' : 'Listing published!',
        isEditMode ? 'Your listing has been updated.' : 'Your listing will be available for booking in a few hours.',
        [{ text: 'OK', onPress: onSuccess }],
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
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
      value: [amenityHighlights || null, form.homeCooked ? 'Home-cooked meals' : null].filter(Boolean).join(' · '),
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
        form.homeCooked && form.mealCost ? `+ ₹${form.mealCost}/day meals` : null,
      ].filter(Boolean).join(' · '),
    },
    {
      label: 'House Rules',
      step: 8,
      value: [
        ruleCount > 0 ? `${ruleCount} rule${ruleCount > 1 ? 's' : ''} set` : null,
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
      <Text style={stSt.title}>{isEditMode ? 'Review & Update' : 'Review & List'}</Text>
      <Text style={stSt.sub}>Here's what guests will see. Tap the card for a full preview.</Text>

      {/* Tappable preview card → full guest view */}
      <TouchableOpacity
        style={rvSt.previewCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ListingDetail', { preview: form })}
      >
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={rvSt.coverPhoto} resizeMode="cover" />
        ) : (
          <View style={rvSt.photoPlaceholder}>
            <Ionicons name="home-outline" size={36} color={COLORS.textMut} />
          </View>
        )}
        <View style={{ padding: SPACING.md }}>
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
            {!isEditMode && (
              <View style={rvSt.newBadge}>
                <Text style={rvSt.newTxt}>✨ New listing</Text>
              </View>
            )}
          </View>
          <View style={rvSt.tapHint}>
            <Ionicons name="eye-outline" size={13} color={COLORS.primary} />
            <Text style={rvSt.tapHintTxt}>Tap to see guest view</Text>
          </View>
        </View>
      </TouchableOpacity>

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={{ color: '#fff', fontSize: 15, ...FONTS.medium }}>
              {uploadProgress
                ? `Uploading photos ${uploadProgress.done} / ${uploadProgress.total}…`
                : isEditMode ? 'Saving…' : 'Publishing…'
              }
            </Text>
          </View>
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, ...FONTS.semibold }}>
            {isEditMode ? 'Confirm update' : 'Publish listing'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={rvSt.backBtn}>
        <Text style={{ fontSize: 15, ...FONTS.medium, color: COLORS.textSec }}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeRvStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  previewCard: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.lg, backgroundColor: COLORS.surface, ...SHADOW.sm },
  coverPhoto: { width: '100%', height: 150, borderRadius: 0 },
  photoPlaceholder: { height: 150, backgroundColor: COLORS.warm, borderRadius: 0, justifyContent: 'center', alignItems: 'center' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tagTxt: { fontSize: 11, ...FONTS.medium, color: COLORS.textSec },
  previewTitle: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, marginTop: SPACING.sm, marginBottom: 6 },
  price: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  newBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.accentAlpha },
  newTxt: { fontSize: 11, ...FONTS.semibold, color: COLORS.primary },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.sm, justifyContent: 'center' },
  tapHintTxt: { fontSize: 12, color: COLORS.primary, ...FONTS.medium },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  summaryLabel: { fontSize: 11, ...FONTS.semibold, color: COLORS.textMut, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  summaryValue: { fontSize: 14, ...FONTS.medium, color: COLORS.text },
  editBtn: { paddingLeft: SPACING.sm },
  editTxt: { fontSize: 14, ...FONTS.semibold, color: COLORS.primary },
  publishBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.sm },
  backBtn: { alignItems: 'center', paddingVertical: SPACING.sm, marginBottom: SPACING.lg },
});

// ─── Shared step styles ───────────────────────────────────────────────────────

const makeStStyles = (COLORS: ThemeColors) => StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontSize: 26, ...FONTS.bold, color: COLORS.text, marginBottom: 6 },
  sub: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.sm, lineHeight: 20 },
  hint: { fontSize: 12, color: COLORS.textMut, marginTop: 6, marginLeft: 2, lineHeight: 17 },
  rulesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryAlpha,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: 8,
    marginBottom: 14,
  },
});

// ─── Helper: map API response → FormData ─────────────────────────────────────

function mapListingToForm(data: any): FormData {
  const p = data.property;
  const r = data.room;
  const hr = data.house_rules;

  const aptTypeMap: Record<string, string> = {
    '1bhk': '1BHK', '2bhk': '2BHK', '3bhk': '3BHK', '4bhk': '4BHK+',
  };
  const minStayMap: Record<number, string> = { 1: '1_night', 2: '2_nights', 3: '3_nights', 7: '1_week', 14: '2_weeks', 30: '1_month' };

  const allFlatmates: any[] = data.flatmates || [];
  const hostFm = allFlatmates.find((f: any) => f.name === '__host__');
  const realFlatmates = allFlatmates.filter((f: any) => f.name !== '__host__');

  return {
    ...INIT,
    apartmentType: aptTypeMap[p.apartment_type] ?? p.apartment_type.toUpperCase(),
    floorNumber: String(p.floor_number),
    totalFloors: p.total_floors != null ? String(p.total_floors) : '',
    apartmentName: p.apartment_name,
    locality: p.address_line1 || '',
    city: p.city_name,
    googlePlaceId: p.google_place_id || '',
    formattedAddress: p.formatted_address || '',
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    state: p.state || '',
    pincode: p.pincode != null ? String(p.pincode) : '',
    roomType: r.room_type,
    bedType: r.bed_type,
    bathroom: r.bathroom_type,

    roomFeatures: r.room_features || [],
    title: data.title,
    description: (() => {
      const raw = data.description || '';
      return raw.replace(/\n\nNearby: .+?(?:\s\(\d+ min walk\))?$/, '').trim();
    })(),
    nearbyLandmarks: (() => {
      const raw = data.description || '';
      const m = raw.match(/\n\nNearby: (.+?)(?:\s\((\d+) min walk\))?$/);
      return m ? [m[1]] : [];
    })(),
    distanceToLandmark: (() => {
      const raw = data.description || '';
      const m = raw.match(/\n\nNearby: .+?\s\((\d+) min walk\)$/);
      return m ? m[1] : '';
    })(),
    flatmates: realFlatmates.map((f: any) => ({
      id: f.id || String(Date.now() + Math.random()),
      name: f.name,
      age: f.age != null ? String(f.age) : '',
      occupation: f.occupation || '',
      hobbies: f.hobbies || '',
      gender: f.gender || '',
      hometown: f.hometown || '',
    })),
    guestGenderPref: p.gender_preference,
    amenities: data.amenities || [],
    kitchenAccess: data.food_kitchen_access,
    homeCooked: data.food_meals_available,
    mealTypes: data.food_meal_types || [],
    mealCost: data.food_meal_cost != null ? String(Math.round(data.food_meal_cost)) : '',
    mealDescription: data.food_meal_description || '',
    nightlyRate: String(Math.round(data.host_price_per_night)),
    minStay: minStayMap[data.min_nights as number] ?? '1_night',
    noSmoking: hr.no_smoking,
    noLoudMusic: hr.no_loud_music,
    noPets: hr.no_pets,
    noParties: hr.no_parties,
    shoesOff: hr.shoes_off,
    kitchenClean: hr.kitchen_clean,
    noAlcohol: hr.no_alcohol,
    lockDoor: hr.lock_door,
    customRules: hr.custom_rules || '',
    cancellationPolicy: hr.cancellation_policy,
    checkInTime: hr.check_in_time,
    checkOutTime: hr.check_out_time,
    hostAge: data.host?.age != null ? String(data.host.age) : '',
    hostOccupation: data.host?.occupation || '',
    hostHobbies: data.host?.hobbies || '',
    hostGender: data.host?.gender || '',
    blockedDates: (data.blocked_dates || []).map((bd: any) => ({
      startDate: bd.start_date,
      endDate: bd.end_date,
    })),
    photos: {
      bedroom: data.photos?.bedroom ?? [],
      bathroom: data.photos?.bathroom ?? [],
      kitchen: data.photos?.kitchen ?? [],
      living: data.photos?.living ?? [],
      entrance: [],
      balcony: [],
      other: data.photos?.other ?? [],
    },
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ListingEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HostStackParamList, 'ListingEditor'>>();
  const route = useRoute<RouteProp<HostStackParamList, 'ListingEditor'>>();
  const { user } = useAuth();
  const COLORS = useThemeColors();
  const hdrSt = useMemo(() => makeHdrStyles(COLORS), [COLORS]);
  const listingId = route.params?.listingId;
  const resumeDraft = route.params?.resumeDraft;
  const draftKey = user?.user_id ? getDraftKey(user.user_id) : null;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INIT);
  const [submitting, setSubmitting] = useState(false);
  const [loadingListing, setLoadingListing] = useState(false);
  const hasCheckedDraft = useRef(false);

  // Edit mode: fetch listing data and jump to review step
  useEffect(() => {
    if (!listingId) return;
    setLoadingListing(true);
    getListing(listingId)
      .then((data: any) => {
        setForm(mapListingToForm(data));
        setStep(9);
      })
      .catch(() => {
        Alert.alert('Error', 'Failed to load listing. Please try again.');
        navigation.goBack();
      })
      .finally(() => setLoadingListing(false));
  }, [listingId]);

  // New listing mode: auto-resume draft or start fresh
  useEffect(() => {
    if (listingId || hasCheckedDraft.current || !draftKey) return;
    hasCheckedDraft.current = true;

    if (resumeDraft) {
      AsyncStorage.getItem(draftKey).then((data) => {
        if (!data) return;
        try {
          const saved = JSON.parse(data);
          setForm(saved.form ?? INIT);
          setStep(saved.step ?? 0);
        } catch {
          AsyncStorage.removeItem(draftKey);
        }
      });
    } else {
      AsyncStorage.removeItem(draftKey);
    }
  }, [listingId, resumeDraft, draftKey]);

  const update = useCallback((u: Partial<FormData> | ((prev: FormData) => Partial<FormData>)) => {
    setForm((prev) => ({ ...prev, ...(typeof u === 'function' ? u(prev) : u) }));
  }, []);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, TOTAL_STEPS)), []);

  const back = useCallback(
    () => {
      if (step === 0 || (listingId && step === 9)) {
        navigation.goBack();
      } else {
        setStep((s) => s - 1);
      }
    },
    [step, listingId, navigation]
  );

  const saveExit = useCallback(async () => {
    // For existing listings — save changes to the API
    if (listingId) {
      try {
        await updateListing(listingId, form);
        Alert.alert('Saved', 'Your changes have been saved.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      } catch {
        Alert.alert('Error', 'Could not save changes. Go back without saving?', [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
        ]);
        return;
      }
    }

    // For new listings — save draft locally
    if (draftKey && step > 0) {
      try {
        await AsyncStorage.setItem(draftKey, JSON.stringify({ step, form }));
      } catch {}
    }
    navigation.goBack();
  }, [step, form, listingId, navigation, draftKey]);

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
          navigation={navigation}
          isEditMode={!!listingId}
          listingId={listingId}
          draftKey={draftKey}
        />
      );
      default: return null;
    }
  };

  if (loadingListing) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textSec, fontSize: 14 }}>Loading listing…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}>
      {step === 0 && (
        <View style={hdrSt.row}>
          <TouchableOpacity onPress={back} style={{ width: 36, height: 36, justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      )}
      {step > 0 && <EditorHeader onSaveExit={saveExit} />}
      {step > 0 && step < 10 && <ProgressBar step={step} />}
      {renderStep()}
    </View>
  );
}
