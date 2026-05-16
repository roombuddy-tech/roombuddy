import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import type { GuestStackParamList } from '../../navigation/types';
import { searchListings } from '../../services/search';
import type { GuestListingCard } from '../../types/listing';
import ProfileMenu from '../shared/ProfileMenu';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

const AREAS = ['Koramangala', 'HSR Layout', 'Whitefield', 'Indiranagar', 'BTM Layout', 'JP Nagar'];

const POPULAR_CITIES = [
  { name: 'Bangalore', color: '#EDF1F7' },
  { name: 'Mumbai', color: '#FEF6EE' },
  { name: 'Pune', color: '#E8F0ED' },
  { name: 'Hyderabad', color: '#F3EEFC' },
  { name: 'Delhi NCR', color: '#FEF0F0' },
];

const AMENITY_SHORT: Record<string, { icon: string; label: string }> = {
  WiFi: { icon: 'wifi-outline', label: 'WiFi' },
  AC: { icon: 'snow-outline', label: 'AC' },
  'Full kitchen access': { icon: 'restaurant-outline', label: 'Kitchen' },
  'Washing machine': { icon: 'refresh-circle-outline', label: 'Washer' },
  'Geyser / Hot water': { icon: 'water-outline', label: 'Geyser' },
  'Power backup': { icon: 'battery-charging-outline', label: 'Power' },
  TV: { icon: 'tv-outline', label: 'TV' },
  Fridge: { icon: 'cube-outline', label: 'Fridge' },
  'Parking (2-wheeler)': { icon: 'bicycle-outline', label: 'Parking' },
  'Parking (4-wheeler)': { icon: 'car-outline', label: 'Parking' },
  'Workspace / Desk': { icon: 'desktop-outline', label: 'Desk' },
};

const today = new Date().toISOString().split('T')[0];

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const initial = (user?.first_name?.[0] || user?.display_name?.[0] || 'U').toUpperCase();

  const [showProfile, setShowProfile] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Search form state
  const [query, setQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);

  // Results state
  const [hasSearched, setHasSearched] = useState(false);
  const [listings, setListings] = useState<GuestListingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toggleArea = (area: string) => {
    setSelectedArea((prev) => (prev === area ? null : area));
  };

  const onDayPress = (day: DateData) => {
    if (day.dateString < today) return;
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(day.dateString);
      setCheckOut(null);
    } else {
      if (day.dateString < checkIn) {
        setCheckIn(day.dateString);
      } else {
        setCheckOut(day.dateString);
      }
    }
  };

  const getMarkedDates = () => {
    const marks: Record<string, any> = {};
    if (!checkIn) return marks;
    if (!checkOut) {
      marks[checkIn] = { startingDay: true, endingDay: true, color: COLORS.primary, textColor: '#fff' };
      return marks;
    }
    const cur = new Date(checkIn);
    const end = new Date(checkOut);
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0];
      marks[key] = {
        color: key === checkIn || key === checkOut ? COLORS.primary : COLORS.primaryAlpha,
        textColor: key === checkIn || key === checkOut ? '#fff' : COLORS.primary,
        startingDay: key === checkIn,
        endingDay: key === checkOut,
      };
      cur.setDate(cur.getDate() + 1);
    }
    return marks;
  };

  const canSearch = (query.trim().length > 0 || selectedArea) && checkIn && checkOut;

  const doSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    setSearchExpanded(false);
    try {
      const params: { q?: string; area?: string; check_in?: string; check_out?: string } = {};
      if (query.trim()) params.q = query.trim();
      if (selectedArea) params.area = selectedArea;
      if (checkIn) params.check_in = checkIn;
      if (checkOut) params.check_out = checkOut;
      const data = await searchListings(Object.keys(params).length ? params : undefined);
      setListings(data.results);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedArea, checkIn, checkOut]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    doSearch().finally(() => setRefreshing(false));
  }, [doSearch]);

  const goBackToSearch = () => {
    setHasSearched(false);
    setSearchExpanded(true);
  };

  // ─── Results card ──────────────────────────────────────────────────────

  const renderCard = ({ item }: { item: GuestListingCard }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GuestListingDetail', { listingId: item.listing_id, checkIn: checkIn ?? undefined, checkOut: checkOut ?? undefined })}
    >
      <Image
        source={
          item.cover_photo_url
            ? { uri: item.cover_photo_url }
            : require('../../../assets/icon.png')
        }
        style={styles.cardImg}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardArea}>{item.area_name}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        {item.amenity_highlights.length > 0 && (
          <View style={styles.chipRow}>
            {item.amenity_highlights.slice(0, 4).map((a) => {
              const info = AMENITY_SHORT[a];
              return (
                <View key={a} style={styles.chip}>
                  <Ionicons name={(info?.icon ?? 'checkmark-outline') as any} size={13} color={COLORS.primary} />
                  <Text style={styles.chipText}>{info?.label ?? a}</Text>
                </View>
              );
            })}
          </View>
        )}
        {item.meals_available && (
          <View style={styles.mealRow}>
            <View style={styles.mealChip}>
              <Ionicons name="restaurant-outline" size={11} color={COLORS.accent} />
              <Text style={styles.mealChipText}>Meals available</Text>
            </View>
          </View>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>
            ₹{Math.round(item.guest_price_per_night).toLocaleString('en-IN')}
            <Text style={styles.cardPriceUnit}>/night</Text>
          </Text>
          {item.average_rating !== null && item.review_count > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={COLORS.star} />
              <Text style={styles.ratingText}>
                {item.average_rating.toFixed(1)} ({item.review_count})
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const resultsHeader = (
    <View style={{ marginBottom: SPACING.md }}>
      <TouchableOpacity onPress={goBackToSearch} style={styles.modifyBtn}>
        <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
        <Text style={styles.modifyTxt}>Modify search</Text>
      </TouchableOpacity>
      <View style={styles.searchSummary}>
        <View style={styles.summaryChip}>
          <Ionicons name="location-outline" size={14} color={COLORS.primary} />
          <Text style={styles.summaryTxt}>{query.trim() || selectedArea || 'All areas'}</Text>
        </View>
        <View style={styles.summaryChip}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
          <Text style={styles.summaryTxt}>{fmtDate(checkIn!)} — {fmtDate(checkOut!)}</Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>
        {loading ? 'Searching…' : `${listings.length} room${listings.length !== 1 ? 's' : ''} found`}
      </Text>
    </View>
  );

  const empty = loading ? (
    <View style={styles.emptyWrap}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  ) : (
    <View style={styles.emptyWrap}>
      <Text style={{ fontSize: 48 }}>🏠</Text>
      <Text style={styles.emptyTitle}>No rooms found</Text>
      <Text style={styles.emptySub}>Try adjusting your search or dates</Text>
    </View>
  );

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar: Brand + Bell + Avatar */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>
          Room<Text style={styles.brandAccent}>Buddy</Text>
        </Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)}>
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {hasSearched ? (
        /* ── Results list ── */
        <FlatList
          data={listings}
          keyExtractor={(item) => item.listing_id}
          renderItem={renderCard}
          ListHeaderComponent={resultsHeader}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        />
      ) : searchExpanded ? (
        /* ── Expanded search form ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Close / collapse */}
          <TouchableOpacity
            onPress={() => setSearchExpanded(false)}
            style={styles.closeFormBtn}
          >
            <Ionicons name="close" size={20} color={COLORS.text} />
          </TouchableOpacity>

          {/* Where */}
          <Text style={styles.formLabel}>Where are you looking?</Text>
          <View style={styles.searchBar}>
            <Ionicons name="location-outline" size={18} color={COLORS.textMut} />
            <TextInput
              style={styles.searchInput}
              placeholder="Area, landmark, or city..."
              placeholderTextColor={COLORS.textMut}
              value={query}
              onChangeText={setQuery}
              returnKeyType="done"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textMut} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={AREAS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(a) => a}
            contentContainerStyle={styles.areaList}
            renderItem={({ item: area }) => (
              <TouchableOpacity
                style={[styles.areaChip, selectedArea === area && styles.areaChipActive]}
                onPress={() => toggleArea(area)}
              >
                <Text style={[styles.areaChipText, selectedArea === area && styles.areaChipTextActive]}>
                  {area}
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* When */}
          <Text style={styles.formLabel}>When are you staying?</Text>
          <Text style={styles.formSub}>
            {!checkIn
              ? 'Tap a date to select check-in'
              : !checkOut
              ? 'Now tap your check-out date'
              : `${fmtDate(checkIn)} — ${fmtDate(checkOut)}`}
          </Text>

          <Calendar
            minDate={today}
            markingType="period"
            markedDates={getMarkedDates()}
            onDayPress={onDayPress}
            theme={{
              todayTextColor: COLORS.primary,
              arrowColor: COLORS.primary,
            }}
            style={styles.calendar}
          />

          {checkIn && checkOut && (
            <TouchableOpacity onPress={() => { setCheckIn(null); setCheckOut(null); }} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: COLORS.primary, ...FONTS.medium }}>Clear dates</Text>
            </TouchableOpacity>
          )}

          {/* Search button */}
          <TouchableOpacity
            style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
            activeOpacity={0.85}
            onPress={doSearch}
            disabled={!canSearch}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.searchBtnTxt}>Search rooms</Text>
          </TouchableOpacity>

          {!canSearch && (
            <Text style={styles.searchHint}>
              {!query.trim() && !selectedArea
                ? 'Enter an area or pick one above'
                : !checkIn || !checkOut
                ? 'Select check-in and check-out dates'
                : ''}
            </Text>
          )}
        </ScrollView>
      ) : (
        /* ── Home / Discovery view ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {/* Search pill (Airbnb style) */}
          <TouchableOpacity
            style={styles.searchPill}
            activeOpacity={0.8}
            onPress={() => setSearchExpanded(true)}
          >
            <View style={styles.searchPillIcon}>
              <Ionicons name="search" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.searchPillContent}>
              <Text style={styles.searchPillTitle}>Find a room</Text>
              <Text style={styles.searchPillSub}>Any city · Any dates · Any budget</Text>
            </View>
          </TouchableOpacity>

          {/* Popular cities */}
          <Text style={styles.homeSection}>Popular cities</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.citiesRow}
          >
            {POPULAR_CITIES.map((city) => (
              <TouchableOpacity
                key={city.name}
                style={styles.cityCard}
                onPress={() => {
                  setQuery(city.name);
                  setSearchExpanded(true);
                }}
              >
                <View style={[styles.cityCircle, { backgroundColor: city.color }]}>
                  <Text style={styles.cityEmoji}>
                    {city.name === 'Bangalore' ? '🏙️' :
                     city.name === 'Mumbai' ? '🌊' :
                     city.name === 'Pune' ? '⛰️' :
                     city.name === 'Hyderabad' ? '🕌' : '🏛️'}
                  </Text>
                </View>
                <Text style={styles.cityName}>{city.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Why RoomBuddy */}
          <Text style={styles.homeSection}>Why RoomBuddy?</Text>
          <View style={styles.whyGrid}>
            <View style={styles.whyCard}>
              <Text style={styles.whyEmoji}>💰</Text>
              <Text style={styles.whyTitle}>Budget-friendly</Text>
              <Text style={styles.whySub}>Rooms from ₹500/night</Text>
            </View>
            <View style={styles.whyCard}>
              <Text style={styles.whyEmoji}>🍽️</Text>
              <Text style={styles.whyTitle}>Home meals</Text>
              <Text style={styles.whySub}>Home-cooked food available</Text>
            </View>
            <View style={styles.whyCard}>
              <Text style={styles.whyEmoji}>✅</Text>
              <Text style={styles.whyTitle}>Verified hosts</Text>
              <Text style={styles.whySub}>ID verified for safety</Text>
            </View>
            <View style={styles.whyCard}>
              <Text style={styles.whyEmoji}>📅</Text>
              <Text style={styles.whyTitle}>Flexible stays</Text>
              <Text style={styles.whySub}>1 night to 1 month</Text>
            </View>
          </View>

          {/* How it works */}
          <Text style={styles.homeSection}>How it works</Text>
          <View style={styles.stepsRow}>
            <View style={styles.stepCard}>
              <View style={[styles.stepNum, { backgroundColor: COLORS.primaryAlpha }]}>
                <Text style={[styles.stepNumText, { color: COLORS.primary }]}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Search</Text>
              <Text style={styles.stepSub}>Pick a city and dates</Text>
            </View>
            <View style={styles.stepArrow}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMut} />
            </View>
            <View style={styles.stepCard}>
              <View style={[styles.stepNum, { backgroundColor: COLORS.accentAlpha }]}>
                <Text style={[styles.stepNumText, { color: COLORS.accent }]}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Book</Text>
              <Text style={styles.stepSub}>Reserve instantly</Text>
            </View>
            <View style={styles.stepArrow}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMut} />
            </View>
            <View style={styles.stepCard}>
              <View style={[styles.stepNum, { backgroundColor: '#E8F0ED' }]}>
                <Text style={[styles.stepNumText, { color: '#1B7A4E' }]}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Stay</Text>
              <Text style={styles.stepSub}>Enjoy your stay</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <ProfileMenu visible={showProfile} onClose={() => setShowProfile(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  brand: { fontSize: 22, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: '#fff', fontSize: 16, ...FONTS.bold },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  // Search pill (Airbnb style)
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 40,
    padding: 12,
    gap: 12,
    ...SHADOW.md,
    marginBottom: SPACING.xl,
  },
  searchPillIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchPillContent: { flex: 1 },
  searchPillTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  searchPillSub: { fontSize: 12, color: COLORS.textMut, marginTop: 1 },

  // Home sections
  homeSection: {
    fontSize: 18,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  // Popular cities
  citiesRow: { gap: 14, paddingBottom: SPACING.xl },
  cityCard: { alignItems: 'center', width: 72 },
  cityCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  cityEmoji: { fontSize: 26 },
  cityName: { fontSize: 12, ...FONTS.medium, color: COLORS.textSec, textAlign: 'center' },

  // Why RoomBuddy
  whyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  whyCard: {
    width: '47%',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  whyEmoji: { fontSize: 24, marginBottom: 6 },
  whyTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  whySub: { fontSize: 12, color: COLORS.textMut, lineHeight: 17 },

  // How it works
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  stepCard: { flex: 1, alignItems: 'center' },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNumText: { fontSize: 16, ...FONTS.bold },
  stepTitle: { fontSize: 13, ...FONTS.semibold, color: COLORS.text },
  stepSub: { fontSize: 10, color: COLORS.textMut, textAlign: 'center', marginTop: 2 },
  stepArrow: { paddingHorizontal: 4, paddingBottom: 20 },

  // Expanded search form
  closeFormBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  formLabel: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, marginBottom: SPACING.sm },
  formSub: { fontSize: 13, color: COLORS.textSec, marginBottom: SPACING.sm },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },

  areaList: { gap: 8, marginBottom: SPACING.lg },
  areaChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  areaChipActive: { backgroundColor: COLORS.primaryAlpha, borderColor: COLORS.primary },
  areaChipText: { fontSize: 13, ...FONTS.medium, color: COLORS.text },
  areaChipTextActive: { color: COLORS.primary, ...FONTS.semibold },

  calendar: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    marginTop: SPACING.lg,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnTxt: { color: '#fff', fontSize: 16, ...FONTS.semibold },
  searchHint: { fontSize: 12, color: COLORS.textMut, textAlign: 'center', marginTop: SPACING.sm },

  // Results
  modifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  modifyTxt: { fontSize: 14, color: COLORS.primary, ...FONTS.semibold },
  searchSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryAlpha,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  summaryTxt: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },
  sectionTitle: { fontSize: 17, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },

  card: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  cardImg: { width: '100%', height: 180, backgroundColor: COLORS.surface },
  cardContent: { padding: SPACING.md },
  cardTitle: { fontSize: 16, ...FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  cardArea: { fontSize: 13, color: COLORS.textSec, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.textMut, lineHeight: 18, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  chipText: { fontSize: 11, color: COLORS.textSec, ...FONTS.medium },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: 17, ...FONTS.bold, color: COLORS.text },
  cardPriceUnit: { fontSize: 12, ...FONTS.regular, color: COLORS.textSec },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, color: COLORS.text, ...FONTS.medium },
  mealRow: { flexDirection: 'row', marginBottom: 10 },
  mealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accentAlpha,
  },
  mealChipText: { fontSize: 11, color: COLORS.accent, ...FONTS.medium },
  emptyWrap: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyTitle: { fontSize: 18, ...FONTS.semibold, color: COLORS.text, marginTop: SPACING.md },
  emptySub: { fontSize: 14, color: COLORS.textMut, marginTop: 4 },
});