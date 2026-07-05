import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationBell from '../../components/NotificationBell';

import * as Location from 'expo-location';
import GooglePlacesInput from '../../components/forms/GooglePlacesInput';
import SearchResultsMap from '../../components/maps/SearchResultsMap';
import { FONTS, RADIUS, SPACING, ThemeColors, ThemeShadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { GuestStackParamList, GuestTabParamList } from '../../navigation/types';
import { searchListings } from '../../services/search';
import type { GuestListingCard } from '../../types/listing';
import ProfileMenu from '../shared/ProfileMenu';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

const POPULAR_CITIES = [
  { name: 'Bangalore' },
  { name: 'Mumbai' },
  { name: 'Pune' },
  { name: 'Hyderabad' },
  { name: 'Delhi NCR' },
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

function fmtDateLong(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function nightCount(ci: string, co: string): number {
  return Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000);
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<GuestTabParamList, 'Home'>>();
  const { user, switchRole } = useAuth();
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const initial = (user?.first_name?.[0] || user?.display_name?.[0] || 'U').toUpperCase();

  // Near-you listings (location-based)
  const [nearbyListings, setNearbyListings] = useState<GuestListingCard[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [hasLocation, setHasLocation] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let params: { lat?: number; lng?: number } = {};
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          params = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } else {
          if (active) setHasLocation(false);
        }
        const data = await searchListings(params);
        if (active) setNearbyListings(data.results.slice(0, 10));
      } catch {
        // ignore
      } finally {
        if (active) setNearbyLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const SectionHead = ({ label }: { label: string }) => (
    <View style={styles.sectionHeadRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionHeadTxt}>{label}</Text>
    </View>
  );

  const [showProfile, setShowProfile] = useState(false);

  const [showSearchForm, setShowSearchForm] = useState(false);

  // Search form
  const [query, setQuery] = useState('');
  const [searchLat, setSearchLat] = useState<number | null>(null);
  const [searchLng, setSearchLng] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Results
  const [hasSearched, setHasSearched] = useState(false);
  const [listings, setListings] = useState<GuestListingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [editExpanded, setEditExpanded] = useState(false);

  const searchVersion = useRef(0);

  useEffect(() => {
    if (route.params?.openSearch) {
      setShowSearchForm(true);
      navigation.setParams({ openSearch: undefined } as any);
    }
  }, [route.params?.openSearch]);

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

  const canSearch = query.trim().length > 0 && checkIn && checkOut;

  const doSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    setShowSearchForm(false);
    setEditExpanded(false);
    setShowCalendar(false);
    const version = ++searchVersion.current;
    try {
      const params: { q?: string; check_in?: string; check_out?: string; lat?: number; lng?: number } = {};
      if (query.trim()) params.q = query.trim();
      if (checkIn) params.check_in = checkIn;
      if (checkOut) params.check_out = checkOut;
      if (searchLat != null && searchLng != null) {
        params.lat = searchLat;
        params.lng = searchLng;
      }
      const data = await searchListings(Object.keys(params).length ? params : undefined);
      if (version === searchVersion.current) setListings(data.results);
    } catch {
      if (version === searchVersion.current) setListings([]);
    } finally {
      if (version === searchVersion.current) setLoading(false);
    }
  }, [query, checkIn, checkOut, searchLat, searchLng]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    doSearch().finally(() => setRefreshing(false));
  }, [doSearch]);

  // ─── Search form (reused in search page & edit panel) ──────────────────

  const renderSearchForm = (isEditMode?: boolean) => (
    <View>
      {/* Location */}
      <Text style={styles.fieldLabel}>City, Area or Landmark</Text>
      <GooglePlacesInput
        value={query}
        placeholder="Where are you looking?"
        onSelect={(place) => {
          const area = place.addressLine1 || place.city || place.description;
          setQuery(area);
          setSearchLat(place.lat || null);
          setSearchLng(place.lng || null);
          if (!checkIn) setShowCalendar(true);
        }}
      />

      {/* Date fields */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={[styles.dateBox, showCalendar && styles.dateBoxActive]}
          onPress={() => setShowCalendar(!showCalendar)}
          activeOpacity={0.7}
        >
          <Text style={styles.fieldLabel}>Check-in</Text>
          <Text style={checkIn ? styles.dateValue : styles.datePlaceholder}>
            {checkIn ? fmtDateLong(checkIn) : 'Add date'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateBox, showCalendar && styles.dateBoxActive]}
          onPress={() => setShowCalendar(!showCalendar)}
          activeOpacity={0.7}
        >
          <Text style={styles.fieldLabel}>Check-out</Text>
          <Text style={checkOut ? styles.dateValue : styles.datePlaceholder}>
            {checkOut ? fmtDateLong(checkOut) : 'Add date'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar */}
      {showCalendar && (
        <View style={{ marginTop: SPACING.md }}>
          <Text style={styles.calHint}>
            {!checkIn
              ? 'Select your check-in date'
              : !checkOut
              ? 'Now select check-out'
              : `${nightCount(checkIn, checkOut)} night${nightCount(checkIn, checkOut) !== 1 ? 's' : ''} selected`}
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
            <TouchableOpacity
              onPress={() => { setCheckIn(null); setCheckOut(null); }}
              style={{ alignSelf: 'flex-end', marginTop: 8 }}
            >
              <Text style={{ fontSize: 13, color: COLORS.primary, ...FONTS.medium }}>Clear dates</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Button */}
      <TouchableOpacity
        style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
        activeOpacity={0.85}
        onPress={doSearch}
        disabled={!canSearch}
      >
        <Ionicons name="search" size={16} color="#fff" />
        <Text style={styles.searchBtnTxt}>{isEditMode ? 'Update Search' : 'Search Rooms'}</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Listing card ──────────────────────────────────────────────────────

  const renderCard = ({ item }: { item: GuestListingCard }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GuestListingDetail', { listingId: item.listing_id, checkIn: checkIn ?? undefined, checkOut: checkOut ?? undefined })}
    >
      <Image
        source={item.cover_photo_url ? { uri: item.cover_photo_url } : require('../../../assets/icon.png')}
        style={styles.cardImg}
        resizeMode="cover"
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardArea}>{item.area_name}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        {item.amenity_highlights.length > 0 && (
          <View style={styles.tagRow}>
            {item.amenity_highlights.slice(0, 4).map((a) => {
              const info = AMENITY_SHORT[a];
              return (
                <View key={a} style={styles.tag}>
                  <Ionicons name={(info?.icon ?? 'checkmark-outline') as any} size={12} color={COLORS.primary} />
                  <Text style={styles.tagText}>{info?.label ?? a}</Text>
                </View>
              );
            })}
          </View>
        )}
        {item.meals_available && (
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <View style={styles.mealTag}>
              <Ionicons name="restaurant-outline" size={11} color={COLORS.accent} />
              <Text style={styles.mealTagText}>Meals available</Text>
            </View>
          </View>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>
            {'₹'}{Math.round(item.guest_price_per_night).toLocaleString('en-IN')}
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

  const emptyView = loading ? (
    <View style={styles.emptyWrap}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  ) : (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconChip}>
        <Ionicons name="home-outline" size={26} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>No rooms found</Text>
      <Text style={styles.emptySub}>Try a different area or adjust your dates</Text>
    </View>
  );

  // ─── Results header ────────────────────────────────────────────────────

  const resultsHeader = (
    <View style={{ marginBottom: SPACING.md }}>
      {/* Title row */}
      <View style={styles.resRow}>
        <TouchableOpacity
          onPress={() => {
            if (viewMode === 'map') {
              setViewMode('list');
            } else {
              setHasSearched(false);
              setShowSearchForm(false);
              setEditExpanded(false);
              setQuery('');
              setSearchLat(null);
              setSearchLng(null);
              setCheckIn(null);
              setCheckOut(null);
              setShowCalendar(false);
              setListings([]);
            }
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.resCity}>{query}</Text>
          <TouchableOpacity
            style={styles.resSubRow}
            onPress={() => { setEditExpanded(!editExpanded); setShowCalendar(false); }}
            activeOpacity={0.6}
          >
            <Text style={styles.resDates}>
              {checkIn && checkOut
                ? `${fmtDate(checkIn)} – ${fmtDate(checkOut)}, ${nightCount(checkIn, checkOut)} night${nightCount(checkIn, checkOut) !== 1 ? 's' : ''}`
                : 'Any dates'}
            </Text>
            <Text style={styles.resEditTxt}>Edit</Text>
            <Ionicons name={editExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setViewMode((v) => (v === 'list' ? 'map' : 'list'))}
          style={styles.mapBtn}
        >
          <Ionicons name={viewMode === 'list' ? 'map-outline' : 'list-outline'} size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Edit panel */}
      {editExpanded && (
        <View style={styles.editPanel}>
          {renderSearchForm(true)}
        </View>
      )}

      {/* Count */}
      <Text style={styles.resCount}>
        {loading ? 'Searching…' : `${listings.length} room${listings.length !== 1 ? 's' : ''} found`}
      </Text>
    </View>
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar — hidden on results */}
      {!hasSearched && (
        <View style={styles.topBar}>
          {showSearchForm ? (
            <TouchableOpacity onPress={() => { setShowSearchForm(false); setShowCalendar(false); }}>
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.brand}>
              Room<Text style={styles.brandAccent}>Buddy</Text>
            </Text>
          )}
          <View style={styles.topRight}>
            {!showSearchForm && (
              <TouchableOpacity style={styles.switchBtn} onPress={() => switchRole('host')} activeOpacity={0.7}>
                <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.accent} />
                <Text style={styles.switchBtnTxt}>Host</Text>
              </TouchableOpacity>
            )}
            <NotificationBell style={styles.bellBtn} />
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)}>
              {user?.profile_photo_url ? (
                <Image source={{ uri: user.profile_photo_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarTxt}>{initial}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Results ── */}
      {hasSearched ? (
        viewMode === 'map' ? (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: SPACING.lg }}>{resultsHeader}</View>
            <SearchResultsMap
              listings={listings}
              onListingPress={(id) => navigation.navigate('GuestListingDetail', { listingId: id, checkIn: checkIn ?? undefined, checkOut: checkOut ?? undefined })}
            />
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.listing_id}
            renderItem={renderCard}
            ListHeaderComponent={resultsHeader}
            ListEmptyComponent={emptyView}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          />
        )

      /* ── Search form page ── */
      ) : showSearchForm ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pageTitle}>Search rooms</Text>
          {renderSearchForm()}
        </ScrollView>

      /* ── Home ── */
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.homeWrap}
          showsVerticalScrollIndicator={false}
        >
          {/* Search pill */}
          <TouchableOpacity style={styles.searchPill} activeOpacity={0.8} onPress={() => setShowSearchForm(true)}>
            <View style={styles.pillIcon}>
              <Ionicons name="search" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pillTitle}>Find a room</Text>
              <Text style={styles.pillSub}>Any city · Any dates · Any budget</Text>
            </View>
          </TouchableOpacity>

          {/* Popular cities */}
          <SectionHead label="Popular cities" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.citiesRow}>
            {POPULAR_CITIES.map((city) => (
              <TouchableOpacity
                key={city.name}
                style={styles.cityCard}
                onPress={() => {
                  setQuery(city.name);
                  setSearchLat(null);
                  setSearchLng(null);
                  setShowSearchForm(true);
                  setShowCalendar(true);
                }}
              >
                <View style={styles.cityCircle}>
                  <Text style={styles.cityInitial}>{city.name.charAt(0)}</Text>
                </View>
                <Text style={styles.cityName}>{city.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Near You */}
          <SectionHead label={hasLocation ? "Near you" : "Explore rooms"} />
          {nearbyLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.lg }} />
          ) : nearbyListings.length === 0 ? (
            <Text style={styles.nearbyEmpty}>No properties nearby yet</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyRow}
            >
              {nearbyListings.map((item) => (
                <TouchableOpacity
                  key={item.listing_id}
                  style={styles.nearbyCard}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('GuestListingDetail', { listingId: item.listing_id })}
                >
                  <Image
                    source={item.cover_photo_url ? { uri: item.cover_photo_url } : require('../../../assets/icon.png')}
                    style={styles.nearbyImg}
                    resizeMode="cover"
                  />
                  <View style={styles.nearbyBody}>
                    <Text style={styles.nearbyTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.nearbyArea} numberOfLines={1}>{item.area_name}</Text>
                    <View style={styles.nearbyFooter}>
                      <Text style={styles.nearbyPrice}>
                        {'₹'}{Math.round(item.guest_price_per_night).toLocaleString('en-IN')}
                        <Text style={styles.nearbyPriceUnit}>/night</Text>
                      </Text>
                      {item.average_rating !== null && item.review_count > 0 && (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={11} color={COLORS.star} />
                          <Text style={styles.nearbyRating}>{item.average_rating.toFixed(1)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Trust strip */}
          <View style={styles.trustStrip}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
              <Text style={styles.trustTxt}>Verified hosts</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.primary} />
              <Text style={styles.trustTxt}>Secure payments</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Ionicons name="headset-outline" size={16} color={COLORS.primary} />
              <Text style={styles.trustTxt}>24h support</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <ProfileMenu visible={showProfile} onClose={() => setShowProfile(false)} />
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  brand: { fontSize: 24, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.accentAlpha, borderRadius: RADIUS.pill,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  switchBtnTxt: { fontSize: 12, color: COLORS.accent, ...FONTS.semibold },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.chip, justifyContent: 'center', alignItems: 'center',
  },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarTxt: { color: '#fff', fontSize: 14, ...FONTS.bold },

  // ── Search form ──
  pageTitle: { fontSize: 30, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5, marginBottom: SPACING.lg, marginTop: SPACING.sm },

  fieldLabel: {
    fontSize: 13, color: COLORS.textSec, ...FONTS.semibold, marginBottom: 4,
  },

  dateRow: { flexDirection: 'row', gap: SPACING.md },
  dateBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  dateBoxActive: { borderColor: COLORS.primary },
  dateValue: { fontSize: 15, color: COLORS.text, ...FONTS.semibold, marginTop: 4 },
  datePlaceholder: { fontSize: 15, color: COLORS.textMut, marginTop: 4 },

  calHint: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium, textAlign: 'center', marginBottom: SPACING.sm },
  calendar: {
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },

  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16,
    marginTop: SPACING.lg,
  },
  searchBtnDisabled: { opacity: 0.35 },
  searchBtnTxt: { color: '#fff', fontSize: 16, ...FONTS.bold },

  // ── Results ──
  listPad: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  resRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: SPACING.sm, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  resCity: { fontSize: 20, ...FONTS.bold, color: COLORS.text },
  resSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  resDates: { fontSize: 13, color: COLORS.textSec },
  resEditTxt: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold, marginLeft: 10, marginRight: 2 },
  mapBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    marginLeft: SPACING.sm,
  },

  editPanel: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    ...SHADOW.sm,
  },

  resCount: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium, marginBottom: SPACING.sm },

  // ── Home ──
  homeWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  searchPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 40, padding: 12, gap: 12, ...SHADOW.sm, marginBottom: SPACING.xl,
  },
  pillIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center',
  },
  pillTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  pillSub: { fontSize: 12, color: COLORS.textMut, marginTop: 1 },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  sectionBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: COLORS.primary },
  sectionHeadTxt: { fontSize: 13, ...FONTS.bold, letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.text },
  citiesRow: { gap: 14, paddingBottom: SPACING.xl },
  cityCard: { alignItems: 'center', width: 72 },
  cityCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.chip,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  cityEmoji: { fontSize: 26 },
  cityInitial: { fontSize: 22, ...FONTS.serif, color: COLORS.primary },
  cityName: { fontSize: 12, ...FONTS.medium, color: COLORS.textSec, textAlign: 'center' },

  nearbyRow: { gap: 12, paddingBottom: SPACING.xl },
  nearbyCard: {
    width: 200, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOW.sm,
  },
  nearbyImg: { width: '100%', height: 120, backgroundColor: COLORS.chip },
  nearbyBody: { padding: 10 },
  nearbyTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  nearbyArea: { fontSize: 12, color: COLORS.textMut, marginBottom: 6 },
  nearbyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nearbyPrice: { fontSize: 15, ...FONTS.serif, color: COLORS.text },
  nearbyPriceUnit: { fontSize: 11, ...FONTS.regular, color: COLORS.textSec },
  nearbyRating: { fontSize: 11, color: COLORS.text, ...FONTS.medium },
  nearbyEmpty: { fontSize: 13, color: COLORS.textMut, marginBottom: SPACING.xl },

  trustStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, marginBottom: SPACING.lg,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustTxt: { fontSize: 11, color: COLORS.textSec, ...FONTS.medium },
  trustDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textMut, marginHorizontal: 8 },

  // ── Cards ──
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.md, overflow: 'hidden', ...SHADOW.sm,
  },
  cardImg: { width: '100%', height: 180, backgroundColor: COLORS.surface },
  cardBody: { padding: SPACING.md },
  cardTitle: { fontSize: 17, ...FONTS.serif, color: COLORS.text, marginBottom: 2 },
  cardArea: { fontSize: 13, color: COLORS.textSec, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.textMut, lineHeight: 18, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: COLORS.chip,
  },
  tagText: { fontSize: 11, color: COLORS.chipInk, ...FONTS.semibold },
  mealTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.accentAlpha,
  },
  mealTagText: { fontSize: 11, color: COLORS.accent, ...FONTS.medium },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: 20, ...FONTS.serif, color: COLORS.text },
  cardPriceUnit: { fontSize: 12, ...FONTS.regular, color: COLORS.textSec },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, color: COLORS.text, ...FONTS.medium },

  emptyWrap: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyIconChip: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.chip,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, ...FONTS.serif, color: COLORS.text, marginTop: SPACING.md },
  emptySub: { fontSize: 14, color: COLORS.textMut, marginTop: 4 },
});
