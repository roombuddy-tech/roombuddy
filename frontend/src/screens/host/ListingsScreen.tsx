import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors, ThemeShadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { HostStackParamList, HostTabParamList } from '../../navigation/types';
import api from '../../services/api';

const getDraftKey = (userId: string) => `LISTING_DRAFT_${userId}`;
const TOTAL_STEPS = 9;

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<HostTabParamList, 'Listing'>,
  NativeStackNavigationProp<HostStackParamList>
>;

interface ListingItem {
  listing_id: string;
  title: string;
  area_name: string;
  host_price_per_night: number | null;
  guest_price_per_night: number | null;
  rental_type?: 'monthly' | 'nightly';
  display_price?: number | null;
  price_unit?: string;
  monthly_rent?: number | null;
  recurring_monthly?: number | null;
  status: string;
  visible_to_guests?: boolean;
  average_rating: number | null;
  review_count: number;
  total_bookings: number;
  cover_photo_url: string | null;
}

interface DraftData {
  step: number;
  form: { title?: string; apartmentName?: string };
}

const makeStatusConfig = (COLORS: ThemeColors): Record<string, { label: string; color: string }> => ({
  live: { label: 'Listed', color: COLORS.primary },
  hidden: { label: 'Hidden', color: COLORS.star },
  pending: { label: 'Pending', color: COLORS.star },
  draft: { label: 'Draft', color: COLORS.star },
  paused: { label: 'Paused', color: COLORS.textMut },
  snoozed: { label: 'Snoozed', color: COLORS.textMut },
  delisted: { label: 'Delisted', color: COLORS.danger },
});

function ListingThumbnail({ uri, styles, COLORS }: { uri: string | null; styles: ReturnType<typeof makeStyles>; COLORS: ThemeColors }) {
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
      <Ionicons name="home-outline" size={26} color={COLORS.textMut} />
    </View>
  );
}

function DraftProgressBar({ completed, total, styles }: { completed: number; total: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.draftProgressTrack}>
      <View style={[styles.draftProgressFill, { width: `${(completed / total) * 100}%` }]} />
    </View>
  );
}

export default function ListingsScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<HostTabParamList, 'Listing'>>();
  const { user } = useAuth();
  const { colors: COLORS, shadows: SHADOW } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, SHADOW), [COLORS, SHADOW]);
  const STATUS_CONFIG = useMemo(() => makeStatusConfig(COLORS), [COLORS]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [aadhaarVerified, setAadhaarVerified] = useState(true);
  const [idVerificationStatus, setIdVerificationStatus] = useState('not_submitted');

  const draftKey = user?.user_id ? getDraftKey(user.user_id) : null;

  const fetchListings = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.HOST.LISTINGS);
      setListings(res.data.results);
      setAadhaarVerified(res.data.aadhaar_verified ?? true);
      setIdVerificationStatus(res.data.id_verification_status ?? 'not_submitted');
    } catch (err) {
      console.log('Listings fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadDraft = useCallback(async () => {
    if (!draftKey) { setDraft(null); return; }
    try {
      const data = await AsyncStorage.getItem(draftKey);
      if (data) {
        setDraft(JSON.parse(data));
      } else {
        setDraft(null);
      }
    } catch {
      setDraft(null);
    }
  }, [draftKey]);

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
            if (draftKey) await AsyncStorage.removeItem(draftKey);
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

  // Push the Verification screen as a real route rather than a local <Modal>.
  // RN's Modal renders outside the app's SafeAreaProvider, so the screen's
  // SafeAreaView got 0 insets and its back button sat under the status bar.
  const openVerification = () => navigation.navigate('Verification');

  // "Verify now" from the post-publish prompt lands here with a param.
  // Clear it immediately so it doesn't reopen on every later focus.
  useEffect(() => {
    if (route.params?.openVerification) {
      navigation.setParams({ openVerification: undefined });
      openVerification();
    }
  }, [route.params?.openVerification, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.pageTitle}>My Listings</Text>

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
                    <DraftProgressBar completed={draftStepsCompleted} total={TOTAL_STEPS} styles={styles} />
                  </View>

                  <View style={styles.draftContinueBtn}>
                    <Text style={styles.draftContinueTxt}>Continue</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Aadhaar verification banner */}
            {!aadhaarVerified && listings.some((l) => l.status === 'pending' || l.visible_to_guests === false) && (
              <View style={styles.verifyBanner}>
                <View style={styles.verifyBannerIcon}>
                  <Ionicons
                    name={idVerificationStatus === 'pending' ? 'hourglass-outline' : idVerificationStatus === 'rejected' ? 'alert-circle' : 'shield-outline'}
                    size={24}
                    color={idVerificationStatus === 'rejected' ? COLORS.danger : COLORS.primary}
                  />
                </View>
                <View style={styles.verifyBannerContent}>
                  <Text style={styles.verifyBannerTitle}>
                    {idVerificationStatus === 'pending'
                      ? 'Aadhaar under review'
                      : idVerificationStatus === 'rejected'
                        ? 'Aadhaar verification failed'
                        : 'Verify your Aadhaar'}
                  </Text>
                  <Text style={styles.verifyBannerText}>
                    {idVerificationStatus === 'pending'
                      ? 'Your listings will go live once your Aadhaar is verified (24-48 hrs).'
                      : idVerificationStatus === 'rejected'
                        ? 'Please resubmit your Aadhaar to list your properties.'
                        : 'Upload your Aadhaar to make your listings visible to guests.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.verifyBannerBtn}
                  onPress={() => openVerification()}
                >
                  <Text style={styles.verifyBannerBtnTxt}>
                    {idVerificationStatus === 'pending' ? 'Check status' : idVerificationStatus === 'rejected' ? 'Resubmit' : 'Verify now'}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
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
                  const isHidden = item.status === 'live' && item.visible_to_guests === false;
                  // Everything that would go live the moment Aadhaar clears.
                  // 'pending' was stamped at creation (host unverified then);
                  // 'live' is held back by visible_to_guests. Both are blocked
                  // by the same thing, so both get the same call to action.
                  const needsAadhaar =
                    !aadhaarVerified &&
                    item.visible_to_guests === false &&
                    (item.status === 'live' || item.status === 'pending');
                  const statusConfig = STATUS_CONFIG[isHidden ? 'hidden' : item.status] || STATUS_CONFIG.draft;
                  return (
                    <View key={item.listing_id} style={styles.listingCard}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleCardPress(item)}
                      >
                        <View style={styles.photoContainer}>
                          <ListingThumbnail uri={item.cover_photo_url} styles={styles} COLORS={COLORS} />
                          <View style={styles.statusOverlay}>
                            <View style={[styles.statusOverlayDot, { backgroundColor: statusConfig.color }]} />
                            <Text style={styles.statusOverlayTxt}>{statusConfig.label}</Text>
                          </View>
                        </View>

                        <View style={styles.detailsContainer}>
                          <View style={styles.titleRow}>
                            <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textMut} />
                          </View>

                          <Text style={styles.areaName}>{item.area_name}</Text>

                          <View style={styles.bottomRow}>
                            <Text style={styles.price}>
                              ₹{((item.rental_type === 'monthly'
                                    ? (item.recurring_monthly ?? item.display_price ?? item.monthly_rent)
                                    : (item.host_price_per_night ?? item.display_price)) ?? 0).toLocaleString('en-IN')}
                              <Text style={styles.priceUnit}>{item.rental_type === 'monthly' ? '/mo' : '/night'}</Text>
                            </Text>
                            <View style={styles.statsRow}>
                              {item.average_rating ? (
                                <>
                                  <Text style={styles.star}>★</Text>
                                  <Text style={styles.rating}>{item.average_rating}</Text>
                                  <Text style={styles.dot}>·</Text>
                                </>
                              ) : null}
                              <Text style={styles.bookingCount}>{item.total_bookings} bookings</Text>
                            </View>
                          </View>

                          {item.status === 'draft' && (
                            <View style={styles.serverDraftHint}>
                              <Ionicons name="pencil-outline" size={12} color={COLORS.primary} />
                              <Text style={styles.serverDraftHintTxt}>Tap to continue editing</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>

                    {/* Sibling of the card's touchable, never nested inside it —
                        nested touchables race and taps leak through to the card. */}
                    {needsAadhaar && (
                      <TouchableOpacity
                        style={styles.hiddenHint}
                        activeOpacity={0.6}
                        onPress={() => openVerification()}
                      >
                        <Ionicons name="shield-outline" size={16} color={COLORS.star} />
                        <Text style={styles.hiddenHintTxt}>Verify Aadhaar to publish</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.star} />
                      </TouchableOpacity>
                    )}
                  </View>
                  );
                })}
              </View>
            )}

            {/* Empty state — no drafts and no listings */}
            {!draft && listings.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconChip}>
                  <Ionicons name="home-outline" size={28} color={COLORS.primary} />
                </View>
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

const makeStyles = (COLORS: ThemeColors, SHADOW: ThemeShadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  scrollContent: { paddingBottom: SPACING.xl },

  pageTitle: { fontSize: 30, ...FONTS.bold, color: COLORS.text, letterSpacing: -0.5, marginTop: SPACING.md, marginBottom: SPACING.lg },

  loadingArea: { paddingVertical: 60, alignItems: 'center' },

  // ── Draft section ──
  draftSection: { marginBottom: SPACING.lg },
  draftSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  draftSectionTitle: { fontSize: 13, ...FONTS.semibold, color: COLORS.primaryDark },

  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.raised,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  draftIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.chip,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  draftContent: { flex: 1, marginRight: 12 },
  draftTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  draftProgress: { fontSize: 12, color: COLORS.primaryDark, ...FONTS.medium, marginBottom: 6 },

  draftProgressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  draftProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  draftContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
  },
  draftContinueTxt: { fontSize: 13, ...FONTS.semibold, color: COLORS.onPrimary },

  // ── Listings section ──
  listingsSection: { marginBottom: SPACING.md },
  sectionLabel: { fontSize: 13, ...FONTS.medium, color: COLORS.textSec, marginBottom: SPACING.sm },

  listingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOW.md,
  },

  photoContainer: { position: 'relative' },
  photo: { width: '100%', height: 170 },
  photoPlaceholder: { backgroundColor: COLORS.warm, justifyContent: 'center', alignItems: 'center' },
  photoEmoji: { fontSize: 32 },

  statusOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20,18,16,0.62)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusOverlayDot: { width: 6, height: 6, borderRadius: 3 },
  statusOverlayTxt: { fontSize: 12, ...FONTS.semibold, color: '#fff' },

  detailsContainer: { padding: SPACING.lg },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 },
  listingTitle: { fontSize: 17, ...FONTS.semibold, color: COLORS.text, flex: 1, marginRight: 8 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, ...FONTS.medium },

  areaName: { fontSize: 13, color: COLORS.textSec, marginBottom: 10 },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  priceUnit: { fontSize: 12, ...FONTS.regular, color: COLORS.textSec },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 14, color: COLORS.star },
  rating: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },
  dot: { fontSize: 13, color: COLORS.textMut },
  bookingCount: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },

  serverDraftHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  serverDraftHintTxt: { fontSize: 11, color: COLORS.primary, ...FONTS.medium },

  // Full-width action bar across the bottom of the card. 48px tall so it clears
  // the minimum touch target — the old inline text was a ~16px strip and taps
  // routinely missed it.
  hiddenHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.chip,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  hiddenHintTxt: { flex: 1, fontSize: 13, color: COLORS.star, ...FONTS.semibold },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIconChip: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.chip,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xs },
  emptySub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', paddingHorizontal: SPACING.xl },

  // ── Verification banner ──
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.raised,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  verifyBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.chip,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  verifyBannerContent: { flex: 1, marginRight: 12 },
  verifyBannerTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.primaryDark, marginBottom: 2 },
  verifyBannerText: { fontSize: 12, color: COLORS.primaryDark, lineHeight: 17 },
  verifyBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
  },
  verifyBannerBtnTxt: { fontSize: 12, ...FONTS.semibold, color: COLORS.onPrimary },

  // ── Add new listing button (bottom) ──
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    marginTop: SPACING.md,
  },
  addNewBtnTxt: { fontSize: 15, ...FONTS.semibold, color: COLORS.onPrimary },
});
