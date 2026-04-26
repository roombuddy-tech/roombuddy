import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';

interface ListingItem {
  listing_id: string;
  title: string;
  area_name: string;
  host_price_per_night: number;
  guest_price_per_night: number;
  status: string;
  average_rating: number | null;
  review_count: number;
  total_bookings: number;
  cover_photo_url: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  live: { label: 'Listed', color: '#10B981' },
  draft: { label: 'Draft', color: '#F59E0B' },
  paused: { label: 'Paused', color: '#94A3B8' },
  snoozed: { label: 'Snoozed', color: '#94A3B8' },
  delisted: { label: 'Delisted', color: '#EF4444' },
};

export default function ListingsScreen() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = async () => {
    try {
      const res = await api.get(ENDPOINTS.HOST.LISTINGS);
      setListings(res.data.results);
    } catch (err) {
      console.log('Listings fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchListings(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >

        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>My listings</Text>
          <TouchableOpacity style={styles.addBtn}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add listing</Text>
          </TouchableOpacity>
        </View>

        {/* Listings */}
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏠</Text>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptySub}>Tap "+ Add listing" to list your first room and start earning.</Text>
          </View>
        ) : (
          listings.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
            return (
              <TouchableOpacity key={item.listing_id} style={styles.listingCard} activeOpacity={0.7}>
                {/* Photo */}
                <View style={styles.photoContainer}>
                  {item.cover_photo_url ? (
                    <View style={styles.photo}>
                      <Text style={styles.photoEmoji}>🏠</Text>
                    </View>
                  ) : (
                    <View style={styles.photo}>
                      <Text style={styles.photoEmoji}>🏠</Text>
                    </View>
                  )}
                </View>

                {/* Details */}
                <View style={styles.detailsContainer}>
                  <View style={styles.titleRow}>
                    <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.areaName}>{item.area_name}</Text>

                  <View style={styles.bottomRow}>
                    <Text style={styles.price}>₹{item.host_price_per_night.toLocaleString('en-IN')}<Text style={styles.priceUnit}>/night</Text></Text>
                    <View style={styles.statsRow}>
                      {item.average_rating && (
                        <>
                          <Text style={styles.star}>☆</Text>
                          <Text style={styles.rating}>{item.average_rating}</Text>
                        </>
                      )}
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.bookingCount}>{item.total_bookings} bookings</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  scrollContent: { paddingBottom: SPACING.xl },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  pageTitle: { fontSize: 24, ...FONTS.bold, color: COLORS.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accent, paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.pill },
  addBtnText: { color: '#fff', fontSize: 13, ...FONTS.semibold },

  loadingArea: { paddingVertical: 60, alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xs },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', paddingHorizontal: SPACING.xl },

  listingCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },

  photoContainer: { marginRight: 12 },
  photo: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: COLORS.warm, justifyContent: 'center', alignItems: 'center' },
  photoEmoji: { fontSize: 32 },

  detailsContainer: { flex: 1 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  listingTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, flex: 1, marginRight: 8 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, ...FONTS.medium },

  areaName: { fontSize: 13, color: COLORS.textSec, marginBottom: 6 },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 15, ...FONTS.bold, color: COLORS.text },
  priceUnit: { fontSize: 12, ...FONTS.regular, color: COLORS.textSec },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 14, color: COLORS.star },
  rating: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },
  dot: { fontSize: 13, color: COLORS.textMut },
  bookingCount: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md },
  brand: { fontSize: 22, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, ...FONTS.bold },
});