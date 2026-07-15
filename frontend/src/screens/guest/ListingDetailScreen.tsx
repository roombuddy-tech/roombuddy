import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, RADIUS, SHADOW, SPACING, ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import type { GuestStackParamList } from '../../navigation/types';
import { getListingReviews, type ListingReviewsResponse, type ReviewItem } from '../../services/reviews';
import { getGuestListingDetail } from '../../services/search';
import { createUnlockOrder } from '../../services/payments';
import { startListingInquiry } from '../../services/chat';
import type { GuestListingDetail } from '../../types/listing';

type Nav = NativeStackNavigationProp<GuestStackParamList, 'GuestListingDetail'>;
type Rt = RouteProp<GuestStackParamList, 'GuestListingDetail'>;

const { width: SCREEN_W } = Dimensions.get('window');

const AMENITY_ICONS: Record<string, string> = {
  WiFi: 'wifi-outline',
  AC: 'snow-outline',
  'Geyser / Hot water': 'water-outline',
  'Power backup': 'battery-charging-outline',
  'Washing machine': 'refresh-circle-outline',
  Iron: 'shirt-outline',
  'Hair dryer': 'color-wand-outline',
  'Full kitchen access': 'restaurant-outline',
  Fridge: 'cube-outline',
  Microwave: 'radio-outline',
  'Gas stove': 'flame-outline',
  'Water purifier': 'filter-outline',
  'Utensils provided': 'cafe-outline',
  TV: 'tv-outline',
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

const AMENITY_CATEGORIES: Record<string, { label: string; icon: string }> = {
  Essentials: { label: 'Essentials', icon: 'flash-outline' },
  'Kitchen & Food': { label: 'Kitchen & Food', icon: 'restaurant-outline' },
  Comfort: { label: 'Comfort', icon: 'bed-outline' },
  Safety: { label: 'Safety', icon: 'shield-checkmark-outline' },
};

const HOUSE_RULE_CONFIG: Array<{ key: string; label: string; icon: string }> = [
  { key: 'no_smoking', label: 'No smoking', icon: 'close-circle-outline' },
  { key: 'no_loud_music', label: 'No loud music late at night', icon: 'volume-mute-outline' },
  { key: 'no_pets', label: 'No pets', icon: 'paw-outline' },
  { key: 'no_alcohol', label: 'No alcohol in common areas', icon: 'wine-outline' },
  { key: 'no_parties', label: 'No parties or events', icon: 'people-circle-outline' },
  { key: 'shoes_off', label: 'Shoes off at the entrance', icon: 'footsteps-outline' },
  { key: 'kitchen_clean', label: 'Keep the kitchen clean after use', icon: 'cafe-outline' },
  { key: 'lock_door', label: 'Lock the door when leaving', icon: 'lock-closed-outline' },
];



const BREAKDOWN_LABELS: Record<string, string> = {
  cleanliness: 'Cleanliness',
  accuracy: 'Accuracy',
  communication: 'Communication',
  location: 'Location',
  value: 'Value',
  food: 'Food & Kitchen',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function StarDisplay({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= rating ? 'star' : 'star-outline'} size={size} color="#F59E0B" />
      ))}
    </View>
  );
}

function parseNearbyFromDescription(description: string): { cleanDesc: string; nearbyLine: string | null } {
  const lines = description.split('\n');
  let nearbyLine: string | null = null;
  const cleanLines: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith('Nearby:')) {
      nearbyLine = line.trim();
    } else {
      cleanLines.push(line);
    }
  }
  return { cleanDesc: cleanLines.join('\n').trim(), nearbyLine };
}


// ─── screen ───────────────────────────────────────────────────────────────────

export default function GuestListingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { listingId, checkIn: passedCheckIn, checkOut: passedCheckOut, unlockedContact } = route.params;
  const { isAuthenticated } = useAuth();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const SectionTitle = ({ label }: { label: string }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );

  const toggleReviewExpand = (id: string) => {
    setExpandedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const ReviewCard = ({ review }: { review: ReviewItem }) => {
    const isExpanded = expandedReviews.has(review.id);
    return (
      <TouchableOpacity style={styles.reviewCard} activeOpacity={0.8} onPress={() => toggleReviewExpand(review.id)}>
        <View style={styles.reviewCardTop}>
          <View style={styles.reviewerAvatar}>
            <Text style={styles.reviewerInitials}>{initials(review.reviewer_name) || 'G'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
            <Text style={styles.reviewDate}>
              {new Date(review.submitted_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <StarDisplay rating={review.overall_rating} />
        </View>
        {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
        {review.body ? (
          <>
            <Text style={styles.reviewBody} numberOfLines={isExpanded ? undefined : 4}>{review.body}</Text>
            {!isExpanded && review.body.length > 120 && (
              <Text style={styles.readMore}>Read more</Text>
            )}
          </>
        ) : null}
        {review.host_response ? (
          <View style={styles.hostReply}>
            <Text style={styles.hostReplyLabel}>Response from host</Text>
            <Text style={styles.hostReplyBody}>{review.host_response}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const [listing, setListing] = useState<GuestListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookStep, setBookStep] = useState<'rules' | 'dates'>('rules');
  const [checkIn, setCheckIn] = useState<string | null>(passedCheckIn ?? null);
  const [checkOut, setCheckOut] = useState<string | null>(passedCheckOut ?? null);
  const [reviewsData, setReviewsData] = useState<ListingReviewsResponse | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [showHostModal, setShowHostModal] = useState(false);
  const [showHostPhoto, setShowHostPhoto] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const hasDatesFromSearch = !!(passedCheckIn && passedCheckOut);

  const onDayPress = (day: DateData) => {
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(day.dateString); setCheckOut(null);
    } else {
      if (day.dateString <= checkIn) { setCheckIn(day.dateString); setCheckOut(null); }
      else setCheckOut(day.dateString);
    }
  };

  const getMarkedDates = () => {
    const marks: Record<string, any> = {};
    if (!checkIn) return marks;
    if (!checkOut) { marks[checkIn] = { startingDay: true, endingDay: true, color: COLORS.primary, textColor: '#fff' }; return marks; }
    const cur = new Date(checkIn);
    while (cur <= new Date(checkOut)) {
      const key = cur.toISOString().slice(0, 10);
      const isStart = key === checkIn, isEnd = key === checkOut;
      marks[key] = { startingDay: isStart, endingDay: isEnd, color: isStart || isEnd ? COLORS.primary : COLORS.primaryAlpha, textColor: isStart || isEnd ? '#fff' : COLORS.primary };
      cur.setDate(cur.getDate() + 1);
    }
    return marks;
  };

  useEffect(() => {
    getGuestListingDetail(listingId)
      .then((data) => setListing(data))
      .catch(() => setError('Could not load listing'))
      .finally(() => setLoading(false));
    getListingReviews(listingId).then(setReviewsData).catch(() => {});
  }, [listingId]);

  // Contact returned after a successful unlock payment.
  useEffect(() => {
    if (unlockedContact?.phone) {
      setRevealedPhone(unlockedContact.phone);
      navigation.setParams({ unlockedContact: undefined });
    }
  }, [unlockedContact]);

  const handleUnlock = useCallback(async () => {
    if (!isAuthenticated) { (navigation as any).navigate('Login'); return; }
    if (unlocking || !listing) return;
    setUnlocking(true);
    try {
      const res = await createUnlockOrder(listing.listing_id);
      if (res.already_unlocked) {
        // Refresh to pull the real number.
        const fresh = await getGuestListingDetail(listing.listing_id);
        setListing(fresh);
        setRevealedPhone(fresh?.host_phone ?? null);
        return;
      }
      navigation.navigate('RazorpayCheckout', {
        bookingId: '',
        bookingCode: '',
        mode: 'unlock',
        listingId: listing.listing_id,
        order: {
          razorpay_key_id: res.razorpay_key_id,
          order_id: res.order_id,
          amount: res.amount,
          currency: res.currency,
        },
      });
    } catch (err: any) {
      Alert.alert(
        'Could not start payment',
        err?.response?.data?.error || 'Please try again in a moment.',
      );
    } finally {
      setUnlocking(false);
    }
  }, [unlocking, listing, navigation]);

  const handleMessageHost = useCallback(async () => {
    if (!isAuthenticated) { (navigation as any).navigate('Login'); return; }
    if (messaging || !listing) return;
    setMessaging(true);
    try {
      const convo = await startListingInquiry(listing.listing_id);
      (navigation as any).navigate('Chat', {
        conversationId: convo.conversation_id,
        title: listing.host_name || 'Host',
        subtitle: listing.title,
        isInquiry: convo.is_inquiry,
      });
    } catch {
      Alert.alert('Could not start chat', 'Please try again in a moment.');
    } finally {
      setMessaging(false);
    }
  }, [isAuthenticated, messaging, listing, navigation]);

  const onPhotoScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActivePhotoIndex(index);
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
        <Text style={styles.errorText}>{error || 'Listing not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const photos = listing.photos.filter((p) => p.url);
  const photoUrls = photos.map((p) => p.url);
  const subtitleParts = [
    listing.area_name,
    listing.room.bed_type ? `${listing.room.bed_type.charAt(0).toUpperCase()}${listing.room.bed_type.slice(1)} bed` : null,
    listing.amenities.find((a) => a.display_name === 'AC') ? 'AC' : null,
    listing.room.bathroom_type === 'attached' ? 'Attached bath' : listing.room.bathroom_type === 'shared' ? 'Shared bath' : null,
  ].filter(Boolean);

  const handleBookNow = () => {
    if (!checkIn || !checkOut) return;
    setShowBookModal(false);
    navigation.navigate('BookingConfirm', {
      listingId: listing.listing_id, listingTitle: listing.title,
      checkIn, checkOut,
      mealsAvailable: listing.food.meals_available,
      mealCostPerDay: listing.food.meal_cost,
      mealTypes: listing.food.meal_types,
      mealDescription: listing.food.meal_description,
      genderPreference: listing.property.gender_preference,
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const hasReviews = reviewsData && reviewsData.total > 0;

  const { cleanDesc, nearbyLine } = parseNearbyFromDescription(listing.description || '');

  // Group amenities by category
  const amenityGroups = listing.amenities.reduce<Record<string, string[]>>((acc, a) => {
    const cat = a.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a.display_name);
    return acc;
  }, {});

  // Active house rules
  const activeRules = HOUSE_RULE_CONFIG.filter(
    (r) => listing.house_rules[r.key as keyof typeof listing.house_rules] === true
  );
  
  const breakdownEntries = reviewsData
    ? (Object.entries(reviewsData.breakdown).filter(([, v]) => v != null) as [string, number][])
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── Photos ── */}
        <View style={styles.photoWrap}>
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              keyExtractor={(p, i) => `${p.url}-${i}`}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onScroll={onPhotoScroll} scrollEventThrottle={16}
              renderItem={({ item: p, index }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => { setActivePhotoIndex(index); setShowPhotoGallery(true); }}>
                  <Image source={{ uri: p.url }} style={styles.photo} resizeMode="cover" />
                  {p.area ? (
                    <View style={styles.photoTag}>
                      <Text style={styles.photoTagTxt}>{p.area}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.photoPlaceholder}><Ionicons name="home-outline" size={48} color={COLORS.textMut} /></View>
          )}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          {photoUrls.length > 0 && (
            <View style={styles.photoCounter}>
              <Ionicons name="camera-outline" size={13} color="#fff" />
              <Text style={styles.photoCounterTxt}>{photoUrls.length} photo{photoUrls.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>

          {/* ── Title block ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{listing.title}</Text>
            <Text style={styles.subtitle}>{subtitleParts.join(' · ')}</Text>
            <View style={styles.metaRow}>
              {hasReviews && (
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={13} color="#F59E0B" />
                  <Text style={styles.ratingPillTxt}>{reviewsData!.average_rating?.toFixed(1)}</Text>
                  <Text style={styles.ratingPillCount}>({reviewsData!.total} review{reviewsData!.total !== 1 ? 's' : ''})</Text>
                </View>
              )}
              {listing.host_verifications?.aadhaar && (
                <View style={styles.verifiedPill}>
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
                  <Text style={styles.verifiedTxt}>Aadhaar verified</Text>
                </View>
              )}
              {listing.host_verifications?.email && (
                <View style={styles.verifiedPill}>
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
                  <Text style={styles.verifiedTxt}>Email verified</Text>
                </View>
              )}
              {listing.host_verifications?.phone && (
                <View style={styles.verifiedPill}>
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
                  <Text style={styles.verifiedTxt}>Phone verified</Text>
                </View>
              )}
              {listing.booking_mode === 'instant' && (
                <View style={styles.instantPill}>
                  <Ionicons name="flash" size={13} color="#92400E" />
                  <Text style={styles.instantTxt}>Instant book</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── About ── */}
          {cleanDesc ? (
            <View style={styles.section}>
              <SectionTitle label="About this room" />
              <Text style={styles.description}>{cleanDesc.replace(/\n{2,}/g, '\n').trim()}</Text>
            </View>
          ) : null}

          {/* ── The space ── */}
          <View style={styles.section}>
            <SectionTitle label="The space" />
            {listing.property.apartment_name ? (
              <View style={styles.apartmentNameRow}>
                <Ionicons name="business-outline" size={16} color={COLORS.primary} />
                <Text style={styles.apartmentNameTxt}>{listing.property.apartment_name}</Text>
              </View>
            ) : null}
            <View style={styles.spaceList}>
              <View style={styles.spaceRow}>
                <View style={styles.spaceRowIconWrap}><Ionicons name="home-outline" size={18} color={COLORS.primary} /></View>
                <View>
                  <Text style={styles.spaceRowLabel}>{{ '1bhk': '1 BHK', '2bhk': '2 BHK', '3bhk': '3 BHK', '4bhk+': '4 BHK+ / Villa' }[listing.property.apartment_type.toLowerCase()] ?? listing.property.apartment_type}</Text>
                  <Text style={styles.spaceRowSub}>Apartment type</Text>
                </View>
              </View>
              <View style={styles.spaceRow}>
                <View style={styles.spaceRowIconWrap}>
                  <MaterialCommunityIcons name={listing.room.room_type === 'private' ? 'door-closed-lock' : 'bunk-bed-outline'} size={18} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.spaceRowLabel}>
                    {listing.room.room_type === 'private' ? 'Private room' : 'Shared room'}
                    {listing.room.bed_type ? ` · ${listing.room.bed_type.charAt(0).toUpperCase() + listing.room.bed_type.slice(1)} bed` : ''}
                  </Text>
                  <Text style={styles.spaceRowSub}>Room type</Text>
                </View>
              </View>
              <View style={styles.spaceRow}>
                <View style={styles.spaceRowIconWrap}><Ionicons name="water-outline" size={18} color={COLORS.primary} /></View>
                <View>
                  <Text style={styles.spaceRowLabel}>{listing.room.bathroom_type === 'attached' ? 'Attached bath' : 'Shared bath'}</Text>
                  <Text style={styles.spaceRowSub}>Bathroom</Text>
                </View>
              </View>
            </View>
            {listing.room.room_features.length > 0 && (
              <>
                <View style={styles.subHeaderRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.subHeaderText}>What this room has</Text>
                </View>
                <View style={styles.featureRow}>
                  {listing.room.room_features.map((f) => (
                    <View key={f} style={styles.featureChip}><Text style={styles.featureChipText}>{f}</Text></View>
                  ))}
                </View>
              </>
            )}
          </View>

          {nearbyLine && (
            <View style={styles.section}>
              <SectionTitle label="Nearby" />
              <View style={styles.nearbyWrap}>
                {nearbyLine
                  .replace(/^Nearby:\s*/i, '')
                  .split(/[,•·|]/)
                  .map((it) => it.trim())
                  .filter(Boolean)
                  .map((it, i) => (
                    <View key={i} style={styles.nearbyChip}>
                      <Ionicons name="location" size={13} color={COLORS.primary} />
                      <Text style={styles.nearbyChipText}>{it}</Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* ── Flatmates ── */}
          {(listing.flatmates.length > 0 ||
            (listing.host_info && (listing.host_info.age || listing.host_info.occupation || listing.host_info.hobbies || listing.host_info.gender))) && (
            <View style={styles.section}>
              <SectionTitle label="Meet your flatmates" />
              {listing.host_info && (listing.host_info.age || listing.host_info.occupation || listing.host_info.hobbies) && (
                <View style={styles.flatmateCard}>
                  <View style={styles.flatmateAvatar}>
                    <Text style={styles.flatmateInitials}>{listing.host_name ? initials(listing.host_name) : 'H'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.flatmateName}>{listing.host_name || 'Host'}{listing.host_info.age ? `, ${listing.host_info.age}` : ''}</Text>
                      <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>Host</Text></View>
                    </View>
                    {listing.host_info.occupation ? <Text style={styles.flatmateDetail}>Occupation: {listing.host_info.occupation}</Text> : null}
                    {listing.host_info.gender ? <Text style={styles.flatmateDetail}>Gender: {listing.host_info.gender.charAt(0).toUpperCase() + listing.host_info.gender.slice(1)}</Text> : null}
                    {listing.host_info.hobbies ? <Text style={styles.flatmateDetail}>Hobbies: {listing.host_info.hobbies}</Text> : null}
                    {listing.host_info.hometown ? <Text style={styles.flatmateDetail}>Hometown: {listing.host_info.hometown}</Text> : null}
                  </View>
                </View>
              )}
              {listing.flatmates.map((fm, idx) => (
                <View key={idx} style={[styles.flatmateCard, idx === listing.flatmates.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.flatmateAvatar}><Text style={styles.flatmateInitials}>{initials(fm.name)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flatmateName}>{fm.name}{fm.age ? `, ${fm.age}` : ''}</Text>
                    {fm.occupation ? <Text style={styles.flatmateDetail}>Occupation: {fm.occupation}</Text> : null}
                    {fm.gender ? <Text style={styles.flatmateDetail}>Gender: {fm.gender.charAt(0).toUpperCase() + fm.gender.slice(1)}</Text> : null}
                    {fm.hobbies ? <Text style={styles.flatmateDetail}>Hobbies: {fm.hobbies}</Text> : null}
                    {fm.hometown ? <Text style={styles.flatmateDetail}>Hometown: {fm.hometown}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Food ── */}
          {(listing.food.kitchen_access || listing.food.meals_available) && (
            <View style={styles.section}>
              <SectionTitle label="Food options" />
              <View style={styles.foodChipRow}>
                {listing.food.kitchen_access && (
                  <View style={styles.foodChip}>
                    <Ionicons name="restaurant-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.foodChipText}>Kitchen access</Text>
                  </View>
                )}
                {listing.food.meals_available && listing.food.meal_cost !== null && (
                  <View style={styles.foodChip}>
                    <Ionicons name="fast-food-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.foodChipText}>
                      Home meals · ₹{listing.food.meal_cost}/day
                      {listing.food.meal_types ? ` · ${listing.food.meal_types}` : ''}
                    </Text>
                  </View>
                )}
              </View>
              {listing.food.meal_description ? <Text style={styles.foodDesc}>{listing.food.meal_description}</Text> : null}
            </View>
          )}

          {/* ── Amenities (grouped by category) ── */}
          {listing.amenities.length > 0 && (
            <View style={styles.section}>
              <SectionTitle label="What's included" />
              {Object.entries(amenityGroups).map(([category, items]) => {
                const catMeta = AMENITY_CATEGORIES[category];
                return (
                  <View key={category} style={{ marginBottom: SPACING.md }}>
                    <View style={styles.subHeaderRow}>
                      <Ionicons name={(catMeta?.icon ?? 'list-outline') as any} size={16} color={COLORS.primary} />
                      <Text style={styles.subHeaderText}>
                        {catMeta?.label ?? category}
                      </Text>
                    </View>
                    <View style={styles.amenityGrid}>
                      {items.map((name) => (
                        <View key={name} style={styles.amenityRow}>
                          <Ionicons name={(AMENITY_ICONS[name] ?? 'checkmark-outline') as any} size={18} color={COLORS.primary} />
                          <Text style={styles.amenityText}>{name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Map ── */}
          {listing.property.latitude && listing.property.longitude && (
            <View style={styles.section}>
              <SectionTitle label="Location" />
              <View style={styles.miniMapWrap}>
                <MapView
                  style={styles.miniMap} provider={PROVIDER_GOOGLE}
                  initialRegion={{ latitude: listing.property.latitude, longitude: listing.property.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  scrollEnabled zoomEnabled rotateEnabled={false} pitchEnabled={false}
                  toolbarEnabled={false}
                >
                  <Circle center={{ latitude: listing.property.latitude, longitude: listing.property.longitude }} radius={300} fillColor="rgba(184,92,56,0.12)" strokeColor="rgba(184,92,56,0.35)" strokeWidth={1} />
                </MapView>
              </View>
              <Text style={styles.locationDisclaimer}>
                {listing.property.apartment_name ? `Near ${listing.property.apartment_name} · ` : ''}Exact location shared after booking
              </Text>
            </View>
          )}

          {/* ── House Rules ── */}
          {activeRules.length > 0 && (
            <View style={styles.section}>
              <SectionTitle label="House rules" />
              {activeRules.map((rule) => (
                <View key={rule.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <Ionicons name={rule.icon as any} size={18} color={COLORS.danger} />
                  <Text style={{ fontSize: 14, color: COLORS.text, ...FONTS.medium }}>{rule.label}</Text>
                </View>
              ))}
              {listing.house_rules.custom_rules ? (
                <View style={{ marginTop: SPACING.md, backgroundColor: COLORS.raised, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md }}>
                  <Text style={styles.eyebrowLabel}>Additional rules</Text>
                  <Text style={{ fontSize: 13, color: COLORS.textSec, lineHeight: 20 }}>{listing.house_rules.custom_rules}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Stay details (check-in/out + min stay merged) ── */}
          <View style={styles.section}>
            <SectionTitle label="Stay details" />
            <View style={styles.checkinRow}>
              {listing.check_in_from ? (
                <View style={styles.checkinCard}>
                  <Ionicons name="log-in-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.checkinLabel}>Check-in from</Text>
                  <Text style={styles.checkinTime}>{listing.check_in_from}</Text>
                </View>
              ) : null}
              {listing.check_out_by ? (
                <View style={styles.checkinCard}>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.checkinLabel}>Check-out by</Text>
                  <Text style={styles.checkinTime}>{listing.check_out_by}</Text>
                </View>
              ) : null}
              <View style={styles.checkinCard}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <Text style={styles.checkinLabel}>Min stay</Text>
                <Text style={styles.checkinTime}>{listing.min_nights} night{listing.min_nights !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            {listing.security_deposit > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm }}>
                <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textSec} />
                <Text style={{ fontSize: 13, color: COLORS.textSec, ...FONTS.medium }}>Security deposit: ₹{listing.security_deposit.toLocaleString('en-IN')}</Text>
              </View>
            )}
          </View>

          {/* ── About your host ── */}
          {listing.host_name ? (
            <TouchableOpacity
              style={styles.hostCard}
              activeOpacity={0.7}
              onPress={() => setShowHostModal(true)}
            >
              <View style={styles.hostAvatarLg}>
                {listing.host_profile?.photo_url ? (
                  <Image source={{ uri: listing.host_profile.photo_url }} style={styles.hostAvatarImg} />
                ) : (
                  <Text style={styles.hostAvatarInitials}>{initials(listing.host_name)}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hostCardName}>Hosted by {listing.host_name}</Text>
                {listing.host_profile?.member_since ? (
                  <Text style={styles.hostCardSub}>Member since {listing.host_profile.member_since}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMut} />
            </TouchableOpacity>
          ) : null}

          {/* ── Contact host (₹29 unlock) ── */}
          {(() => {
            const phone = revealedPhone || (listing.contact_unlocked ? listing.host_phone : null);
            const unlocked = !!phone;
            const waDigits = phone ? phone.replace(/[^0-9]/g, '') : '';
            return (
              <View style={styles.contactCard}>
                <View style={styles.contactHead}>
                  <View style={styles.sectionAccent} />
                  <Text style={styles.contactEyebrow}>CONTACT HOST</Text>
                </View>
                {unlocked ? (
                  <>
                    <Text style={styles.contactPhone}>{phone}</Text>
                    <View style={styles.contactBtnRow}>
                      <TouchableOpacity
                        style={styles.contactBtn}
                        activeOpacity={0.85}
                        onPress={() => Linking.openURL(`tel:${phone}`)}
                      >
                        <Ionicons name="call" size={16} color="#fff" />
                        <Text style={styles.contactBtnTxt}>Call</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.contactBtn, styles.contactBtnWa]}
                        activeOpacity={0.85}
                        onPress={() => Linking.openURL(`https://wa.me/${waDigits}`)}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                        <Text style={styles.contactBtnTxt}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.contactSub}>
                      Talk to {listing.host_name || 'the host'} directly — ask questions and
                      clear your doubts before you book.
                    </Text>
                    <View style={styles.contactMaskRow}>
                      <Ionicons name="lock-closed" size={15} color={COLORS.textMut} />
                      <Text style={styles.contactMask}>
                        {listing.host_phone_masked || '●●●●●●●●●●'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unlockBtn}
                      activeOpacity={0.85}
                      onPress={handleUnlock}
                      disabled={unlocking}
                    >
                      {unlocking ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="lock-open-outline" size={16} color="#fff" />
                          <Text style={styles.unlockBtnTxt}>
                            Unlock host contact · ₹{listing.unlock_fee ?? 29}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.unlockNote}>One-time fee. Instant access.</Text>
                  </>
                )}

                {/* Free in-app messaging — always available */}
                <View style={styles.msgDivider}>
                  <View style={styles.msgDividerLine} />
                  <Text style={styles.msgDividerTxt}>or</Text>
                  <View style={styles.msgDividerLine} />
                </View>
                <TouchableOpacity
                  style={styles.msgHostBtn}
                  activeOpacity={0.85}
                  onPress={handleMessageHost}
                  disabled={messaging}
                >
                  {messaging ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.msgHostBtnTxt}>Message host — free</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.unlockNote}>
                  Chat in the app. Phone numbers are shared after you book.
                </Text>
              </View>
            );
          })()}

          {/* ── Reviews ── */}
          {hasReviews && (
            <View style={styles.section}>
              <View style={styles.reviewsHeader}>
                <View style={styles.sectionAccent} />
                <Ionicons name="star" size={18} color="#F59E0B" />
                <Text style={styles.sectionTitle}>
                  {reviewsData!.average_rating?.toFixed(1)}{'  ·  '}{reviewsData!.total} review{reviewsData!.total !== 1 ? 's' : ''}
                </Text>
              </View>
              {breakdownEntries.length > 0 && (
                <View style={styles.breakdownWrap}>
                  {breakdownEntries.map(([key, val]) => (
                    <View key={key} style={[styles.breakdownRow, { marginBottom: key === breakdownEntries[breakdownEntries.length - 1][0] ? 0 : 10 }]}>
                      <Text style={styles.breakdownLabel}>{BREAKDOWN_LABELS[key] ?? key}</Text>
                      <View style={styles.breakdownTrack}>
                        <View style={[styles.breakdownFill, { width: `${(val / 5) * 100}%` as any }]} />
                      </View>
                      <Text style={styles.breakdownVal}>{val.toFixed(1)}</Text>
                    </View>
                  ))}
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: SPACING.lg }}>
                {reviewsData!.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
              </ScrollView>
              {reviewsData!.total > reviewsData!.reviews.length && (
                <TouchableOpacity style={styles.showAllReviewsBtn} activeOpacity={0.7} onPress={() => setShowAllReviews(true)}>
                  <Text style={styles.showAllReviewsTxt}>Show all {reviewsData!.total} reviews</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky bar ── */}
      <View style={styles.stickyBar}>
        <View>
          <Text style={styles.stickyPrice}>
            ₹{listing.guest_price_per_night.toLocaleString('en-IN')}
            <Text style={styles.stickyPriceUnit}>/night</Text>
          </Text>
          {hasReviews && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.stickyRating}>{reviewsData!.average_rating?.toFixed(1)} · {reviewsData!.total} reviews</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.stickyBookBtn} activeOpacity={0.85} onPress={() => {
          if (!isAuthenticated) { (navigation as any).navigate('Login'); return; }
          setBookStep('rules'); setShowBookModal(true);
        }}>
          <Text style={styles.stickyBookBtnText}>Book now</Text>
        </TouchableOpacity>
      </View>

      {/* ── Photo Gallery Modal ── */}
      {showPhotoGallery && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowPhotoGallery(false)}>
          <View style={styles.galleryOverlay}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: activePhotoIndex * SCREEN_W, y: 0 }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setActivePhotoIndex(idx);
              }}
              style={{ flex: 1 }}
            >
              {photoUrls.map((uri, i) => (
                <View key={i} style={{ width: SCREEN_W, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <Image source={{ uri }} style={styles.galleryPhoto} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
            <View style={styles.galleryHeader} pointerEvents="box-none">
              <TouchableOpacity style={styles.galleryCloseBtn} onPress={() => setShowPhotoGallery(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.galleryCounter}>
                  {activePhotoIndex + 1} / {photoUrls.length}
                </Text>
                {photos[activePhotoIndex]?.area ? (
                  <Text style={styles.galleryTag}>{photos[activePhotoIndex].area}</Text>
                ) : null}
              </View>
              <View style={{ width: 40 }} />
            </View>
          </View>
        </Modal>
      )}

      {/* ── Modal ── */}
      <Modal visible={showBookModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {bookStep === 'rules' ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>House rules</Text>
                  <TouchableOpacity onPress={() => setShowBookModal(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
                </View>
                <Text style={styles.rulesIntro}>Please review the house rules before booking</Text>
                <ScrollView style={styles.rulesScroll} showsVerticalScrollIndicator={false}>
                  {activeRules.length > 0 ? (
                    <>
                      {activeRules.map((rule) => (
                        <View key={rule.key} style={styles.modalRuleRow}>
                          <Ionicons name={rule.icon as any} size={20} color={COLORS.danger} />
                          <Text style={styles.modalRuleText}>{rule.label}</Text>
                        </View>
                      ))}
                      {listing.house_rules.custom_rules && (
                        <View style={styles.modalCustomRules}>
                          <Text style={styles.eyebrowLabel}>Additional rules</Text>
                          <Text style={styles.modalCustomRulesText}>{listing.house_rules.custom_rules}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={styles.noRulesText}>No specific house rules</Text>
                  )}
                </ScrollView>
                <TouchableOpacity style={styles.modalBtn} onPress={() => hasDatesFromSearch ? handleBookNow() : setBookStep('dates')} activeOpacity={0.85}>
                  <Text style={styles.modalBtnText}>I agree, continue</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setBookStep('rules')}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></TouchableOpacity>
                  <Text style={styles.modalTitle}>Select dates</Text>
                  <TouchableOpacity onPress={() => setShowBookModal(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
                </View>
                <Text style={styles.calendarHint}>
                  {!checkIn ? 'Select check-in date' : !checkOut ? 'Select check-out date' : `${checkIn}  to  ${checkOut}`}
                </Text>
                <Calendar
                  minDate={today} markingType="period" markedDates={getMarkedDates()} onDayPress={onDayPress}
                  theme={{ todayTextColor: COLORS.primary, arrowColor: COLORS.primary, textDayFontWeight: '500', textMonthFontWeight: '700', textDayHeaderFontWeight: '600', textDayFontSize: 14, textMonthFontSize: 16 }}
                />
                {listing.min_nights > 1 && <Text style={styles.modalHint}>Minimum stay: {listing.min_nights} nights</Text>}
                <TouchableOpacity style={[styles.modalBtn, (!checkIn || !checkOut) && styles.modalBtnDisabled]} onPress={handleBookNow} activeOpacity={0.85} disabled={!checkIn || !checkOut}>
                  <Text style={styles.modalBtnText}>Continue to booking</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Host profile modal ── */}
      <Modal visible={showHostModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.hostModalContent}>
            <View style={styles.hostModalHeader}>
              <Text style={styles.hostModalTitle}>About your host</Text>
              <TouchableOpacity onPress={() => { setShowHostPhoto(false); setShowHostModal(false); }} hitSlop={8}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.hostModalProfile}>
                <View style={styles.hostModalAvatarWrap}>
                  {listing.host_profile?.photo_url ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setShowHostPhoto(true)}>
                      <Image source={{ uri: listing.host_profile.photo_url }} style={styles.hostModalAvatar} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.hostModalAvatarFallback}>
                      <Text style={styles.hostModalAvatarInitials}>{initials(listing.host_name)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.hostModalName}>{listing.host_profile?.full_name || listing.host_name}</Text>
                {listing.host_profile?.member_since ? (
                  <Text style={styles.hostModalMeta}>Member since {listing.host_profile.member_since}</Text>
                ) : null}
              </View>

              <View style={styles.hostModalDetails}>
                {listing.host_profile?.age ? (
                  <View style={styles.hostModalRow}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                    <View>
                      <Text style={styles.hostModalRowLabel}>Age</Text>
                      <Text style={styles.hostModalRowValue}>{listing.host_profile.age} years</Text>
                    </View>
                  </View>
                ) : null}
                {listing.host_profile?.hometown ? (
                  <View style={styles.hostModalRow}>
                    <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                    <View>
                      <Text style={styles.hostModalRowLabel}>From</Text>
                      <Text style={styles.hostModalRowValue}>{listing.host_profile.hometown}</Text>
                    </View>
                  </View>
                ) : null}
                {listing.host_profile?.occupation ? (
                  <View style={styles.hostModalRow}>
                    <Ionicons name="briefcase-outline" size={18} color={COLORS.primary} />
                    <View>
                      <Text style={styles.hostModalRowLabel}>Work</Text>
                      <Text style={styles.hostModalRowValue}>{listing.host_profile.occupation}</Text>
                    </View>
                  </View>
                ) : null}
                {listing.host_profile?.gender ? (
                  <View style={styles.hostModalRow}>
                    <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                    <View>
                      <Text style={styles.hostModalRowLabel}>Gender</Text>
                      <Text style={styles.hostModalRowValue}>{listing.host_profile.gender.charAt(0).toUpperCase() + listing.host_profile.gender.slice(1)}</Text>
                    </View>
                  </View>
                ) : null}
                {listing.host_profile?.hobbies ? (
                  <View style={styles.hostModalRow}>
                    <Ionicons name="heart-outline" size={18} color={COLORS.primary} />
                    <View>
                      <Text style={styles.hostModalRowLabel}>Hobbies</Text>
                      <Text style={styles.hostModalRowValue}>{listing.host_profile.hobbies}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>

          {/* Full host photo — rendered inside the same modal to avoid nested-modal issues */}
          {showHostPhoto && listing.host_profile?.photo_url && (
            <View style={styles.hostPhotoOverlay}>
              <TouchableOpacity style={styles.hostPhotoTapArea} activeOpacity={1} onPress={() => setShowHostPhoto(false)}>
                <Image source={{ uri: listing.host_profile.photo_url }} style={styles.hostPhotoFull} resizeMode="contain" />
              </TouchableOpacity>
              <View style={styles.galleryHeader} pointerEvents="box-none">
                <TouchableOpacity style={styles.galleryCloseBtn} onPress={() => setShowHostPhoto(false)}>
                  <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
                <View style={{ width: 40 }} />
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── All Reviews modal ── */}
      <Modal visible={showAllReviews} animationType="slide">
        <SafeAreaView style={styles.allReviewsModal}>
          <View style={styles.allReviewsHeader}>
            <TouchableOpacity onPress={() => setShowAllReviews(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.allReviewsTitle}>
                  {reviewsData?.average_rating?.toFixed(1)} · {reviewsData?.total} review{reviewsData?.total !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <View style={{ width: 24 }} />
          </View>
          {breakdownEntries.length > 0 && (
            <View style={[styles.breakdownWrap, { marginHorizontal: SPACING.lg, marginBottom: SPACING.md }]}>
              {breakdownEntries.map(([key, val]) => (
                <View key={key} style={[styles.breakdownRow, { marginBottom: key === breakdownEntries[breakdownEntries.length - 1][0] ? 0 : 10 }]}>
                  <Text style={styles.breakdownLabel}>{BREAKDOWN_LABELS[key] ?? key}</Text>
                  <View style={styles.breakdownTrack}>
                    <View style={[styles.breakdownFill, { width: `${(val / 5) * 100}%` as any }]} />
                  </View>
                  <Text style={styles.breakdownVal}>{val.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          )}
          <FlatList
            data={reviewsData?.reviews ?? []}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: r }) => <ReviewCard review={r} />}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: SPACING.lg },
  errorText: { fontSize: 16, color: COLORS.text, textAlign: 'center', marginTop: SPACING.md, ...FONTS.medium },
  retryBtn: { marginTop: SPACING.lg, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: COLORS.primary, borderRadius: RADIUS.md },
  retryBtnText: { color: '#fff', ...FONTS.semibold },

  photoWrap: { position: 'relative', width: SCREEN_W, height: 300, backgroundColor: COLORS.surface },
  photo: { width: SCREEN_W, height: 300 },
  photoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', top: 14, left: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', ...SHADOW.sm },
  photoCounter: { position: 'absolute', bottom: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  photoTag: { position: 'absolute', bottom: 14, left: 14, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  photoTagTxt: { fontSize: 12, color: '#fff', ...FONTS.medium, textTransform: 'capitalize' },
  photoCounterTxt: { fontSize: 12, color: '#fff', ...FONTS.medium },
  galleryOverlay: { flex: 1, backgroundColor: '#000' },
  hostPhotoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 20 },
  hostPhotoTapArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hostPhotoFull: { width: SCREEN_W, height: SCREEN_W },
  galleryHeader: { position: 'absolute', top: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md },
  galleryCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  galleryCounter: { fontSize: 16, color: '#fff', ...FONTS.semibold },
  galleryTag: { fontSize: 13, color: 'rgba(255,255,255,0.7)', ...FONTS.medium, marginTop: 2 },
  galleryPhoto: { width: SCREEN_W, height: SCREEN_W },

  body: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },

  titleBlock: { marginBottom: SPACING.lg },
  title: { fontSize: 26, ...FONTS.serifMedium, color: COLORS.text, marginBottom: 6, lineHeight: 32, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: COLORS.textSec, ...FONTS.regular, marginBottom: 12, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF3C7', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  ratingPillTxt: { fontSize: 13, ...FONTS.semibold, color: '#92400E' },
  ratingPillCount: { fontSize: 12, color: '#B45309', ...FONTS.regular },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primaryAlpha, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedTxt: { fontSize: 12, ...FONTS.semibold, color: COLORS.primary },
  instantPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,184,0,0.12)', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  instantTxt: { fontSize: 12, ...FONTS.semibold, color: '#92400E' },

  section: { marginBottom: SPACING.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: COLORS.primary },
  sectionTitle: { ...FONTS.bold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.text },
  description: { fontSize: 14, color: COLORS.textSec, lineHeight: 22 },

  subHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  subHeaderText: { ...FONTS.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.textSec },
  eyebrowLabel: { ...FONTS.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.textMut, marginBottom: 6 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.md },

  flatmateCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  flatmateAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  flatmateInitials: { fontSize: 15, ...FONTS.bold, color: COLORS.primary },
  flatmateName: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  flatmateDetail: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  hostBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha },
  hostBadgeText: { fontSize: 10, ...FONTS.semibold, color: COLORS.primary },

  foodChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha },
  foodChipText: { fontSize: 13, color: COLORS.primary, ...FONTS.medium },
  foodDesc: { fontSize: 13, color: COLORS.textSec, lineHeight: 20 },

  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  amenityRow: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingRight: SPACING.sm },
  amenityText: { fontSize: 14, color: COLORS.text, ...FONTS.medium, flex: 1 },

  apartmentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  apartmentNameTxt: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  spaceList: { gap: 0, marginBottom: SPACING.sm },
  spaceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  spaceRowIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  spaceRowLabel: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  spaceRowSub: { fontSize: 12, color: COLORS.textSec, marginTop: 1 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, ...SHADOW.sm },
  featureChipText: { fontSize: 12, color: COLORS.text, ...FONTS.medium },
  nearbyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nearbyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha },
  nearbyChipText: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },

  miniMapWrap: { borderRadius: RADIUS.lg, overflow: 'hidden', height: 180, marginBottom: 6 },
  miniMap: { width: '100%', height: 180 },
  locationDisclaimer: { fontSize: 12, color: COLORS.textMut, textAlign: 'center' },

  contactCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOW.md,
  },
  contactHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  contactEyebrow: { fontSize: 13, ...FONTS.bold, letterSpacing: 0.8, color: COLORS.text },
  contactSub: { fontSize: 13, color: COLORS.textSec, lineHeight: 19, marginBottom: 12 },
  contactMaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  contactMask: { fontSize: 16, ...FONTS.semibold, color: COLORS.textMut, letterSpacing: 2 },
  contactPhone: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: 12, letterSpacing: 0.5 },
  contactBtnRow: { flexDirection: 'row', gap: SPACING.sm },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 12,
  },
  contactBtnWa: { backgroundColor: '#25D366' },
  contactBtnTxt: { color: '#fff', fontSize: 14, ...FONTS.semibold },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 14,
  },
  unlockBtnTxt: { color: '#fff', fontSize: 15, ...FONTS.bold },
  unlockNote: { fontSize: 12, color: COLORS.textMut, textAlign: 'center', marginTop: 8 },
  msgDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  msgDividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  msgDividerTxt: { fontSize: 12, color: COLORS.textMut, ...FONTS.medium },
  msgHostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.primaryAlpha,
  },
  msgHostBtnTxt: { color: COLORS.primary, fontSize: 15, ...FONTS.bold },

  checkinRow: { flexDirection: 'row', gap: SPACING.sm },
  checkinCard: { flex: 1, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, alignItems: 'center', gap: 8, ...SHADOW.md },
  checkinLabel: { fontSize: 12, color: COLORS.textSec, ...FONTS.medium, textAlign: 'center' },
  checkinTime: { fontSize: 16, ...FONTS.bold, color: COLORS.text, textAlign: 'center' },

  reviewsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  breakdownWrap: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { width: 116, fontSize: 13, color: COLORS.textSec },
  breakdownTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  breakdownFill: { height: 5, borderRadius: 3, backgroundColor: '#F59E0B' },
  breakdownVal: { width: 30, fontSize: 13, ...FONTS.semibold, color: COLORS.text, textAlign: 'right' },
  reviewCard: { width: 280, backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  reviewCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryAlpha, alignItems: 'center', justifyContent: 'center' },
  reviewerInitials: { fontSize: 14, ...FONTS.bold, color: COLORS.primary },
  reviewerName: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  reviewDate: { fontSize: 12, color: COLORS.textMut, marginTop: 1 },
  reviewTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  reviewBody: { fontSize: 14, color: COLORS.textSec, lineHeight: 21 },
  readMore: { fontSize: 13, ...FONTS.semibold, color: COLORS.primary, marginTop: 4 },
  hostReply: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  hostReplyLabel: { fontSize: 12, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  hostReplyBody: { fontSize: 13, color: COLORS.textSec, lineHeight: 19 },
  showAllReviewsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderWidth: 1.5, borderColor: COLORS.text, borderRadius: RADIUS.md, marginTop: SPACING.xs },
  showAllReviewsTxt: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  allReviewsModal: { flex: 1, backgroundColor: COLORS.bg },
  allReviewsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  allReviewsTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.text },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingBottom: 30, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.md },
  stickyPrice: { fontSize: 24, ...FONTS.serifMedium, color: COLORS.text, letterSpacing: -0.3 },
  stickyPriceUnit: { fontSize: 13, ...FONTS.regular, color: COLORS.textSec },
  stickyRating: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  stickyBookBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: RADIUS.pill, ...SHADOW.sm },
  stickyBookBtnText: { color: '#fff', fontSize: 16, ...FONTS.bold },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  rulesIntro: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.md },
  rulesScroll: { marginBottom: SPACING.md },
  modalRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalRuleText: { fontSize: 15, color: COLORS.text, ...FONTS.medium },
  modalCustomRules: { backgroundColor: COLORS.raised, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginTop: SPACING.md },
  modalCustomRulesText: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },
  noRulesText: { fontSize: 14, color: COLORS.textMut, paddingVertical: SPACING.md },
  modalTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  calendarHint: { fontSize: 14, color: COLORS.primary, ...FONTS.medium, textAlign: 'center', marginBottom: SPACING.sm },
  modalHint: { fontSize: 12, color: COLORS.textMut, marginTop: SPACING.sm },
  modalBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.pill, alignItems: 'center', marginTop: SPACING.md },
  modalBtnDisabled: { backgroundColor: COLORS.border },
  modalBtnText: { color: '#fff', fontSize: 16, ...FONTS.bold },

  hostCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: SPACING.lg, marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    ...SHADOW.md,
  },
  hostAvatarLg: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  hostAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  hostAvatarInitials: { fontSize: 18, ...FONTS.bold, color: COLORS.primary },
  hostCardName: { fontSize: 16, ...FONTS.semibold, color: COLORS.text },
  hostCardSub: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },

  hostModalContent: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: 40, maxHeight: '70%',
  },
  hostModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg, paddingBottom: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  hostModalTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  hostModalProfile: { alignItems: 'center', marginBottom: SPACING.lg },
  hostModalAvatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  hostModalAvatar: { width: 88, height: 88, borderRadius: 44 },
  hostModalAvatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center', alignItems: 'center',
  },
  hostModalAvatarInitials: { fontSize: 32, ...FONTS.bold, color: COLORS.primary },
  hostModalName: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  hostModalMeta: { fontSize: 14, color: COLORS.textSec },
  hostModalDetails: { gap: 0 },
  hostModalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  hostModalRowLabel: { fontSize: 12, color: COLORS.textSec },
  hostModalRowValue: { fontSize: 15, ...FONTS.semibold, color: COLORS.text, marginTop: 1 },
});
