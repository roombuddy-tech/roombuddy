import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';
import type { GuestStackParamList } from '../../navigation/types';
import { submitReview } from '../../services/reviews';

type RouteProps = NativeStackScreenProps<GuestStackParamList, 'WriteReview'>['route'];


const SUB_CATEGORIES = [
  { key: 'cleanliness_rating', label: 'Cleanliness' },
  { key: 'accuracy_rating', label: 'Accuracy' },
  { key: 'communication_rating', label: 'Communication' },
  { key: 'location_rating', label: 'Location' },
  { key: 'value_rating', label: 'Value' },
  { key: 'food_rating', label: 'Food & Kitchen' },
] as const;

export default function WriteReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { bookingId, listingTitle, hostName } = route.params;
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const StarRow = ({ rating, onRate }: { rating: number; onRate: (n: number) => void }) => (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onRate(n)} activeOpacity={0.7}>
          <Ionicons
            name={n <= rating ? 'star' : 'star-outline'}
            size={32}
            color={n <= rating ? '#F59E0B' : COLORS.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const SubStarRow = ({ rating, onRate }: { rating: number; onRate: (n: number) => void }) => (
    <View style={styles.subStars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onRate(n)} activeOpacity={0.7}>
          <Ionicons
            name={n <= rating ? 'star' : 'star-outline'}
            size={22}
            color={n <= rating ? '#F59E0B' : COLORS.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const [overall, setOverall] = useState(0);
  const [subs, setSubs] = useState<Record<string, number>>({});
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setSub = (key: string, val: number) =>
    setSubs((prev) => ({ ...prev, [key]: val }));

  const onSubmit = async () => {
    if (overall === 0) {
      Alert.alert('Overall rating required', 'Please give an overall star rating.');
      return;
    }
    setSubmitting(true);
    try {
      await submitReview(bookingId, {
        overall_rating: overall,
        ...Object.fromEntries(Object.entries(subs).filter(([, v]) => v > 0)),
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      Alert.alert('Review submitted', 'Thanks for sharing your feedback!', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Write a review</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.propertyName} numberOfLines={2}>{listingTitle}</Text>
          <Text style={styles.hostLine}>Hosted by {hostName}</Text>

          {/* Overall */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Overall experience</Text>
            <StarRow rating={overall} onRate={setOverall} />
            {overall > 0 && (
              <Text style={styles.ratingHint}>
                {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][overall]}
              </Text>
            )}
          </View>

          {/* Sub-categories */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabelTxt}>Rate specific aspects </Text>
              <Text style={[styles.sectionLabelTxt, styles.optional]}>(optional)</Text>
            </View>
            {SUB_CATEGORIES.map(({ key, label }) => (
              <View key={key} style={styles.subRow}>
                <Text style={styles.subLabel}>{label}</Text>
                <SubStarRow rating={subs[key] ?? 0} onRate={(v) => setSub(key, v)} />
              </View>
            ))}
          </View>

          {/* Text */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabelTxt}>Write your review </Text>
              <Text style={[styles.sectionLabelTxt, styles.optional]}>(optional)</Text>
            </View>
            <TextInput
              style={styles.titleInput}
              placeholder="Give it a title…"
              placeholderTextColor={COLORS.textMut}
              value={title}
              onChangeText={setTitle}
              maxLength={255}
            />
            <TextInput
              style={styles.bodyInput}
              placeholder="What did you love? What could be better?"
              placeholderTextColor={COLORS.textMut}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (overall === 0 || submitting) && styles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={overall === 0 || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnTxt}>Submit review</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },
  propertyName: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  hostLine: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.xl },
  section: { marginBottom: SPACING.xl },
  sectionLabel: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, marginBottom: SPACING.md },
  // Row + pieces: a nested <Text> in a different fontFamily is clipped, not
  // wrapped, on Android when the label runs past one line.
  sectionLabelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: SPACING.md },
  sectionLabelTxt: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  optional: { ...FONTS.regular, color: COLORS.textMut },
  stars: { flexDirection: 'row', gap: 8 },
  ratingHint: { fontSize: 14, color: COLORS.textSec, marginTop: 6 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  subLabel: { fontSize: 14, color: COLORS.text, ...FONTS.medium },
  subStars: { flexDirection: 'row', gap: 4 },
  titleInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: 15, color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  bodyInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: 14, color: COLORS.text,
    minHeight: 120,
  },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.lg, backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnTxt: { color: '#fff', fontSize: 16, ...FONTS.bold },
});
