import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { DateData, MarkedDates } from 'react-native-calendars/src/types';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import type { HostStackParamList } from '../../navigation/types';
import {
  type BlockedPeriod,
  createBlockedPeriod,
  deleteBlockedPeriod,
  getBlockedPeriods,
} from '../../services/listings';

type Route = RouteProp<HostStackParamList, 'PauseListing'>;

const today = new Date().toISOString().split('T')[0];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export default function PauseListingScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { listingId } = route.params;

  const [periods, setPeriods] = useState<BlockedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const fetchPeriods = useCallback(async () => {
    try {
      const data = await getBlockedPeriods(listingId);
      setPeriods(data);
    } catch {
      setPeriods([]);
    }
  }, [listingId]);

  useEffect(() => {
    setLoading(true);
    fetchPeriods().finally(() => setLoading(false));
  }, [fetchPeriods]);

  const onDayPress = (day: DateData) => {
    if (day.dateString < today) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(day.dateString);
      setEndDate(null);
    } else if (day.dateString < startDate) {
      setStartDate(day.dateString);
      setEndDate(null);
    } else {
      setEndDate(day.dateString);
    }
  };

  const getMarkedDates = (): MarkedDates => {
    const marks: MarkedDates = {};

    // Existing blocked periods shown as grey
    for (const p of periods) {
      const dates = getDatesInRange(p.start_date, p.end_date);
      for (let i = 0; i < dates.length; i++) {
        marks[dates[i]] = {
          color: COLORS.border,
          textColor: COLORS.textMut,
          ...(i === 0 ? { startingDay: true } : {}),
          ...(i === dates.length - 1 ? { endingDay: true } : {}),
        };
      }
    }

    // New selection
    if (startDate && endDate) {
      const dates = getDatesInRange(startDate, endDate);
      for (let i = 0; i < dates.length; i++) {
        const isStart = i === 0;
        const isEnd = i === dates.length - 1;
        marks[dates[i]] = {
          color: isStart || isEnd ? COLORS.primary : COLORS.primaryAlpha,
          textColor: isStart || isEnd ? '#fff' : COLORS.primary,
          startingDay: isStart,
          endingDay: isEnd,
        };
      }
    } else if (startDate) {
      marks[startDate] = {
        color: COLORS.primary,
        textColor: '#fff',
        startingDay: true,
        endingDay: true,
      };
    }

    return marks;
  };

  const handleBlock = async () => {
    if (!startDate || !endDate) return;
    setSaving(true);
    try {
      await createBlockedPeriod(listingId, startDate, endDate, reason.trim());
      setStartDate(null);
      setEndDate(null);
      setReason('');
      await fetchPeriods();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Could not block these dates. They may overlap with existing bookings or blocked periods.';
      Alert.alert('Cannot block dates', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (period: BlockedPeriod) => {
    Alert.alert(
      'Remove blocked dates?',
      `${formatDate(period.start_date)} — ${formatDate(period.end_date)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBlockedPeriod(listingId, period.id);
              await fetchPeriods();
            } catch {
              Alert.alert('Error', 'Could not remove this blocked period.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pause listing</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.subtitle}>
          Select a date range to block bookings. Guests won't be able to book during these dates.
        </Text>

        {/* Calendar */}
        <Calendar
          minDate={today}
          markingType="period"
          markedDates={getMarkedDates()}
          onDayPress={onDayPress}
          theme={{
            todayTextColor: COLORS.primary,
            arrowColor: COLORS.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12,
          }}
          style={styles.calendar}
        />

        {/* Selected range summary */}
        {startDate && (
          <View style={styles.selectionCard}>
            <View style={styles.selectionDates}>
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>From</Text>
                <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.textMut} />
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>To</Text>
                <Text style={styles.dateValue}>
                  {endDate ? formatDate(endDate) : 'Select end date'}
                </Text>
              </View>
            </View>

            <TextInput
              style={styles.reasonInput}
              placeholder="Reason (optional)"
              placeholderTextColor={COLORS.textMut}
              value={reason}
              onChangeText={setReason}
            />

            <TouchableOpacity
              style={[styles.blockBtn, (!endDate || saving) && styles.blockBtnDisabled]}
              disabled={!endDate || saving}
              onPress={handleBlock}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.blockBtnText}>Block dates</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Existing blocked periods */}
        <Text style={styles.sectionTitle}>Blocked periods</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: SPACING.lg }}
          />
        ) : periods.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={40} color={COLORS.textMut} />
            <Text style={styles.emptyText}>No blocked periods yet</Text>
          </View>
        ) : (
          periods.map((p) => (
            <View key={p.id} style={styles.periodCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.periodDates}>
                  {formatDate(p.start_date)} — {formatDate(p.end_date)}
                </Text>
                {p.reason ? (
                  <Text style={styles.periodReason}>{p.reason}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(p)}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, ...FONTS.bold, color: COLORS.text },

  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSec,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },

  calendar: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },

  selectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  selectionDates: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  dateBox: { flex: 1 },
  dateLabel: { fontSize: 11, color: COLORS.textMut, ...FONTS.medium, marginBottom: 2 },
  dateValue: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },

  reasonInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  blockBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  blockBtnDisabled: { opacity: 0.5 },
  blockBtnText: { color: '#fff', fontSize: 15, ...FONTS.semibold },

  sectionTitle: {
    fontSize: 17,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 14, color: COLORS.textMut },

  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodDates: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  periodReason: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },

  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
