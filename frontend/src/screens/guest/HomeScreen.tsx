import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import type { GuestStackParamList } from '../../navigation/types';
import { searchListings } from '../../services/search';
import type { GuestListingCard } from '../../types/listing';
import ProfileMenu from '../shared/ProfileMenu';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

const AREAS = ['Koramangala', 'HSR Layout', 'Whitefield', 'Indiranagar', 'BTM Layout', 'JP Nagar'];

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

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { switchRole, user } = useAuth();
  const initial = (user?.first_name?.[0] || user?.display_name?.[0] || 'U').toUpperCase();

  const [showProfile, setShowProfile] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [listings, setListings] = useState<GuestListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = useCallback(async (q?: string, area?: string) => {
    try {
      const params: { q?: string; area?: string } = {};
      if (q?.trim()) params.q = q.trim();
      if (area) params.area = area;
      const data = await searchListings(Object.keys(params).length ? params : undefined);
      setListings(data.results);
    } catch {
      setListings([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchListings(query, selectedArea ?? undefined).finally(() => setLoading(false));
  }, [selectedArea]);

  const onSearch = useCallback(() => {
    setLoading(true);
    fetchListings(query, selectedArea ?? undefined).finally(() => setLoading(false));
  }, [query, selectedArea, fetchListings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListings(query, selectedArea ?? undefined).finally(() => setRefreshing(false));
  }, [query, selectedArea, fetchListings]);

  const toggleArea = (area: string) => {
    setSelectedArea((prev) => (prev === area ? null : area));
  };

  const renderCard = ({ item }: { item: GuestListingCard }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GuestListingDetail', { listingId: item.listing_id })}
    >
      {/* Cover image */}
      <Image
        source={
          item.cover_photo_url
            ? { uri: item.cover_photo_url }
            : require('../../../assets/icon.png')
        }
        style={styles.cardImg}
        resizeMode="cover"
      />

      {/* Card content */}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>

        <Text style={styles.cardArea}>{item.area_name}</Text>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        {/* Amenity icons */}
        {item.amenity_highlights.length > 0 && (
          <View style={styles.chipRow}>
            {item.amenity_highlights.slice(0, 4).map((a) => {
              const info = AMENITY_SHORT[a];
              return (
                <View key={a} style={styles.chip}>
                  <Ionicons
                    name={(info?.icon ?? 'checkmark-outline') as any}
                    size={13}
                    color={COLORS.primary}
                  />
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

        {/* Price */}
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

  const header = (
    <>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity style={[styles.toggleBtn, styles.toggleActive]}>
          <Ionicons name="search-outline" size={16} color={COLORS.primary} />
          <Text style={styles.toggleActiveText}>Find a room</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toggleBtn} onPress={() => switchRole('host')}>
          <Ionicons name="home-outline" size={16} color={COLORS.textSec} />
          <Text style={styles.toggleText}>Host a room</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMut} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by area, landmark..."
          placeholderTextColor={COLORS.textMut}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); onSearch(); }}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMut} />
          </TouchableOpacity>
        )}
      </View>

      {/* Area chips */}
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

      {/* Section title */}
      <Text style={styles.sectionTitle}>Available rooms</Text>
    </>
  );

  const empty = loading ? (
    <View style={styles.emptyWrap}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  ) : (
    <View style={styles.emptyWrap}>
      <Text style={{ fontSize: 48 }}>🏠</Text>
      <Text style={styles.emptyTitle}>No rooms found</Text>
      <Text style={styles.emptySub}>Try adjusting your search or area filter</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
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
              <Image source={{ uri: user.profile_photo_url }} style={{ width: 38, height: 38, borderRadius: 19 }} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.listing_id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      />

      <ProfileMenu visible={showProfile} onClose={() => setShowProfile(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, ...FONTS.bold },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  toggleActive: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  toggleText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  toggleActiveText: { fontSize: 14, color: COLORS.primary, ...FONTS.semibold },

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
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  areaChipActive: { backgroundColor: COLORS.primaryAlpha, borderColor: COLORS.primary },
  areaChipText: { fontSize: 13, ...FONTS.medium, color: COLORS.text },
  areaChipTextActive: { color: COLORS.primary, ...FONTS.semibold },

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
  cardImg: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.warm,
  },
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
