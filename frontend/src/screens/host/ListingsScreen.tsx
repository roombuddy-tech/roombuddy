import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import type { HostStackParamList, HostTabParamList } from '../../navigation/types';
import api from '../../services/api';

const DRAFT_KEY = 'LISTING_DRAFT_NEW';
const TOTAL_STEPS = 9;

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<HostTabParamList, 'Listing'>,
  NativeStackNavigationProp<HostStackParamList>
>;

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

interface DraftData {
  step: number;
  form: { title?: string; apartmentName?: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  live: { label: 'Listed', color: '#10B981' },
  draft: { label: 'Draft', color: '#F59E0B' },
  paused: { label: 'Paused', color: '#94A3B8' },
  snoozed: { label: 'Snoozed', color: '#94A3B8' },
  delisted: { label: 'Delisted', color: '#EF4444' },
};

function ListingThumbnail({ uri }: { uri: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={styles.photo}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[styles.photo, styles.photoPlaceholder]}>
      <Text style={styles.photoEmoji}>🏠</Text>
    </View>
  );
}

function DraftProgressBar({ completed, total }: { completed: number; total: number }) {
  return (
    <View style={styles.draftProgressTrack}>
      <View style={[styles.draftProgressFill, { width: `${(completed / total) * 100}%` }]} />
    </View>
  );
}

export default function ListingsScreen() {
  const navigation = useNavigation<NavProp>();
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState<DraftData | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.HOST.LISTINGS);
      setListings(res.data.results);
    } catch (err) {
      console.log('Listings fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadDraft = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(DRAFT_KEY);
      if (data) {
        setDraft(JSON.parse(data));
      } else {
        setDraft(null);
      }
    } catch {
      setDraft(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchListings();
      loadDraft();
    }, [fetchListings, loadDraft])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
    loadDraft();
  };

  const handleCardPress = (item: ListingItem) => {
    if (item.status === 'draft') {
      navigation.navigate('ListingEditor', { listingId: item.listing_id });
    } else {
      navigation.navigate('ListingDetail', { item });
    }
  };

  const handleResumeDraft = () => {
    navigation.navigate('ListingEditor', { resumeDraft: true });
  };

  const handleDeleteDraft = () => {
    Alert.alert(
      'Delete draft',
      'Are you sure you want to discard this draft? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(DRAFT_KEY);
            setDraft(null);
          },
        },
      ],
    );
  };

  const handleAddNew = () => {
    navigation.navigate('ListingEditor', {});
  };

  const draftTitle = draft?.form?.title?.trim() || draft?.form?.apartmentName?.trim() || 'Untitled listing';
  const draftStepsCompleted = draft ? Math.max(0, draft.step) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.pageTitle}>My listings</Text>

        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            {/* Draft card */}
            {draft && (
              <View style={styles.draftSection}>
                <View style={styles.draftSectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="pencil-outline" size={16} color="#92400E" />
                    <Text style={styles.draftSectionTitle}>Unfinished listing</Text>
                  </View>
                  <TouchableOpacity onPress={handleDeleteDraft} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color="#D97706" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.draftCard}
                  activeOpacity={0.7}
                  onPress={handleResumeDraft}
                >
                  <View style={styles.draftIconWrap}>
                    <Ionicons name="document-text-outline" size={28} color="#D97706" />
                  </View>

                  <View style={styles.draftContent}>
                    <Text style={styles.draftTitle} numberOfLines={1}>{draftTitle}</Text>
                    <Text style={styles.draftProgress}>
                      {draftStepsCompleted} of {TOTAL_STEPS} steps completed
                    </Text>
                    <DraftProgressBar completed={draftStepsCompleted} total={TOTAL_STEPS} />
                  </View>

                  <View style={styles.draftContinueBtn}>
                    <Text style={styles.draftContinueTxt}>Continue</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Active listings */}
            {listings.length > 0 && (
              <View style={styles.listingsSection}>
                {(draft || listings.length > 0) && (
                  <Text style={styles.sectionLabel}>
                    {listings.length === 1 ? '1 listing' : `${listings.length} listings`}
                  </Text>
                )}
                {listings.map((item) => {
                  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                  return (
                    <TouchableOpacity
                      key={item.listing_id}
                      style={styles.listingCard}
                      activeOpacity={0.7}
                      onPress={() => handleCardPress(item)}
                    >
                      <View style={styles.photoContainer}>
                        <ListingThumbnail uri={item.cover_photo_url} />
                      </View>

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
                          <Text style={styles.price}>
                            ₹{item.host_price_per_night.toLocaleString('en-IN')}
                            <Text style={styles.priceUnit}>/night</Text>
                          </Text>
                          <View style={styles.statsRow}>
                            {item.average_rating ? (
                              <>
                                <Text style={styles.star}>☆</Text>
                                <Text style={styles.rating}>{item.average_rating}</Text>
                                <Text style={styles.dot}>·</Text>
                              </>
                            ) : null}
                            <Text style={styles.bookingCount}>{item.total_bookings} bookings</Text>
                          </View>
                        </View>

                        {item.status === 'draft' && (
                          <View style={styles.serverDraftHint}>
                            <Ionicons name="pencil-outline" size={12} color={COLORS.accent} />
                            <Text style={styles.serverDraftHintTxt}>Tap to continue editing</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Empty state — no drafts and no listings */}
            {!draft && listings.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏠</Text>
                <Text style={styles.emptyTitle}>No listings yet</Text>
                <Text style={styles.emptySub}>List your first room and start earning.</Text>
              </View>
            )}

            {/* Add new listing button — always at bottom */}
            <TouchableOpacity style={styles.addNewBtn} activeOpacity={0.85} onPress={handleAddNew}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.addNewBtnTxt}>Add new listing</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  scrollContent: { paddingBottom: SPACING.xl },

  pageTitle: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.lg },

  loadingArea: { paddingVertical: 60, alignItems: 'center' },

  // ── Draft section ──
  draftSection: { marginBottom: SPACING.lg },
  draftSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  draftSectionTitle: { fontSize: 13, ...FONTS.semibold, color: '#92400E' },

  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  draftIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  draftContent: { flex: 1, marginRight: 12 },
  draftTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  draftProgress: { fontSize: 12, color: '#92400E', ...FONTS.medium, marginBottom: 6 },

  draftProgressTrack: {
    height: 4,
    backgroundColor: '#FDE68A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  draftProgressFill: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 2,
  },

  draftContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
  },
  draftContinueTxt: { fontSize: 13, ...FONTS.semibold, color: '#fff' },

  // ── Listings section ──
  listingsSection: { marginBottom: SPACING.md },
  sectionLabel: { fontSize: 13, ...FONTS.medium, color: COLORS.textSec, marginBottom: SPACING.sm },

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
  photo: { width: 64, height: 64, borderRadius: RADIUS.sm, overflow: 'hidden' },
  photoPlaceholder: { backgroundColor: COLORS.warm, justifyContent: 'center', alignItems: 'center' },
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

  serverDraftHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  serverDraftHintTxt: { fontSize: 11, color: COLORS.accent, ...FONTS.medium },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xs },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', paddingHorizontal: SPACING.xl },

  // ── Add new listing button (bottom) ──
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  addNewBtnTxt: { fontSize: 15, ...FONTS.semibold, color: '#fff' },
});
