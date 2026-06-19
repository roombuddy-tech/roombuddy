import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
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
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import type { GuestStackParamList } from '../../navigation/types';
import { getListingReviews, type ListingReviewsResponse, type ReviewItem } from '../../services/reviews';
import { getGuestListingDetail } from '../../services/search';
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

function SectionTitle({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
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

function ReviewCard({ review }: { review: ReviewItem }) {
  return (
    <View style={styles.reviewCard}>
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
      {review.body ? <Text style={styles.reviewBody} numberOfLines={4}>{review.body}</Text> : null}
      {review.host_response ? (
        <View style={styles.hostReply}>
          <Text style={styles.hostReplyLabel}>Response from host</Text>
          <Text style={styles.hostReplyBody}>{review.host_response}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function GuestListingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { listingId, checkIn: passedCheckIn, checkOut: passedCheckOut } = route.params;

  const [listing, setListing] = useState<GuestListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookStep, setBookStep] = useState<'rules' | 'dates'>('rules');
  const [checkIn, setCheckIn] = useState<string | null>(passedCheckIn ?? null);
  const [checkOut, setCheckOut] = useState<string | null>(passedCheckOut ?? null);
  const [reviewsData, setReviewsData] = useState<ListingReviewsResponse | null>(null);

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

  const onPhotoScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {}, []);

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

  const photoUrls = listing.photos.map((p) => p.url).filter(Boolean);
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
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const hasReviews = reviewsData && reviewsData.total > 0;
  const breakdownEntries = reviewsData
    ? (Object.entries(reviewsData.breakdown).filter(([, v]) => v != null) as [string, number][])
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── Photos ── */}
        <View style={styles.photoWrap}>
          {photoUrls.length > 0 ? (
            <FlatList
              data={photoUrls}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onScroll={onPhotoScroll} scrollEventThrottle={16}
              renderItem={({ item: uri }) => <Image source={{ uri }} style={styles.photo} resizeMode="cover" />}
            />
          ) : (
            <View style={styles.photoPlaceholder}><Ionicons name="home-outline" size={48} color={COLORS.textMut} /></View>
          )}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
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
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark-circle" size={13} color="#047857" />
                <Text style={styles.verifiedTxt}>Verified</Text>
              </View>
              {listing.booking_mode === 'instant' && (
                <View style={styles.instantPill}>
                  <Ionicons name="flash" size={13} color="#92400E" />
                  <Text style={styles.instantTxt}>Instant book</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── About ── */}
          {listing.description ? (
            <View style={styles.section}>
              <SectionTitle label="About this room" />
              <Text style={styles.description}>{listing.description.replace(/\n{2,}/g, '\n').trim()}</Text>
            </View>
          ) : null}

          {/* ── Flatmates ── */}
          {listing.flatmates.length > 0 && (
            <View style={styles.section}>
              <SectionTitle label="Meet your flatmates" />
              {listing.host_info && (listing.host_info.occupation || listing.host_info.hobbies) && (
                <View style={styles.flatmateCard}>
                  <View style={styles.flatmateAvatar}>
                    <Text style={styles.flatmateInitials}>{listing.host_name ? initials(listing.host_name) : 'H'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.flatmateName}>{listing.host_name || 'Host'}</Text>
                      <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>Host</Text></View>
                    </View>
                    {listing.host_info.occupation ? <Text style={styles.flatmateDetail}>{listing.host_info.occupation}</Text> : null}
                    {listing.host_info.hobbies ? <Text style={styles.flatmateDetail}>{listing.host_info.hobbies}</Text> : null}
                  </View>
                </View>
              )}
              {listing.flatmates.map((fm, idx) => (
                <View key={idx} style={[styles.flatmateCard, idx === listing.flatmates.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.flatmateAvatar}><Text style={styles.flatmateInitials}>{initials(fm.name)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flatmateName}>{fm.name}{fm.age ? `, ${fm.age}` : ''}</Text>
                    {fm.occupation ? <Text style={styles.flatmateDetail}>{fm.occupation}</Text> : null}
                    {fm.hobbies ? <Text style={styles.flatmateDetail}>{fm.hobbies}</Text> : null}
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
                    <Text style={styles.foodChipText}>Tiffin at Rs.{listing.food.meal_cost}/meal</Text>
                  </View>
                )}
              </View>
              {listing.food.meal_description ? <Text style={styles.foodDesc}>{listing.food.meal_description}</Text> : null}
            </View>
          )}

          {/* ── Amenities ── */}
          {listing.amenities.length > 0 && (
            <View style={styles.section}>
              <SectionTitle label="Amenities" />
              <View style={styles.amenityGrid}>
                {listing.amenities.map((a) => (
                  <View key={a.display_name} style={styles.amenityRow}>
                    <Ionicons name={(AMENITY_ICONS[a.display_name] ?? 'checkmark-outline') as any} size={18} color={COLORS.primary} />
                    <Text style={styles.amenityText}>{a.display_name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── The space ── */}
          <View style={styles.section}>
            <SectionTitle label="The space" />
            <View style={styles.spaceGrid}>
              <View style={styles.spaceCard}>
                <View style={styles.spaceCardIconWrap}><Ionicons name="home-outline" size={20} color={COLORS.primary} /></View>
                <Text style={styles.spaceCardLabel}>{listing.property.apartment_type}</Text>
                {listing.property.floor_number > 0 && <Text style={styles.spaceCardSub}>Floor {listing.property.floor_number}</Text>}
              </View>
              <View style={styles.spaceCard}>
                <View style={styles.spaceCardIconWrap}>
                  <MaterialCommunityIcons name={listing.room.room_type === 'private' ? 'door-closed-lock' : 'bunk-bed-outline'} size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.spaceCardLabel}>{listing.room.room_type === 'private' ? 'Private room' : 'Shared room'}</Text>
                {listing.room.bed_type && <Text style={styles.spaceCardSub}>{listing.room.bed_type.charAt(0).toUpperCase() + listing.room.bed_type.slice(1)} bed</Text>}
              </View>
              <View style={styles.spaceCard}>
                <View style={styles.spaceCardIconWrap}><Ionicons name="water-outline" size={20} color={COLORS.primary} /></View>
                <Text style={styles.spaceCardLabel}>{listing.room.bathroom_type === 'attached' ? 'Attached bath' : 'Shared bath'}</Text>
              </View>
              {listing.room.room_size_sqft && (
                <View style={styles.spaceCard}>
                  <View style={styles.spaceCardIconWrap}><Ionicons name="expand-outline" size={20} color={COLORS.primary} /></View>
                  <Text style={styles.spaceCardLabel}>{listing.room.room_size_sqft} sq ft</Text>
                </View>
              )}
            </View>
            {listing.room.room_features.length > 0 && (
              <View style={styles.featureRow}>
                {listing.room.room_features.map((f) => (
                  <View key={f} style={styles.featureChip}><Text style={styles.featureChipText}>{f}</Text></View>
                ))}
              </View>
            )}
          </View>

          {/* ── Map ── */}
          {listing.property.latitude && listing.property.longitude && (
            <View style={styles.section}>
              <SectionTitle label="Approximate location" />
              <View style={styles.miniMapWrap}>
                <MapView
                  style={styles.miniMap} provider={PROVIDER_GOOGLE}
                  initialRegion={{ latitude: listing.property.latitude, longitude: listing.property.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
                >
                  <Circle center={{ latitude: listing.property.latitude, longitude: listing.property.longitude }} radius={300} fillColor="rgba(13,115,119,0.12)" strokeColor="rgba(13,115,119,0.3)" strokeWidth={1} />
                </MapView>
              </View>
              <Text style={styles.locationDisclaimer}>Exact location shared after booking</Text>
            </View>
          )}

          {/* ── Check-in / out ── */}
          {(listing.check_in_from || listing.check_out_by) && (
            <View style={styles.section}>
              <SectionTitle label="Check-in & Check-out" />
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
              </View>
            </View>
          )}

          {/* ── Stay info ── */}
          <View style={styles.section}>
            <SectionTitle label="Stay details" />
            <View style={styles.stayInfoRow}>
              <View style={styles.stayInfoItem}>
                <Text style={styles.stayInfoLabel}>Min stay</Text>
                <Text style={styles.stayInfoValue}>{listing.min_nights} night{listing.min_nights !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.stayInfoItem}>
                <Text style={styles.stayInfoLabel}>Max stay</Text>
                <Text style={styles.stayInfoValue}>{listing.max_nights} night{listing.max_nights !== 1 ? 's' : ''}</Text>
              </View>
              {listing.security_deposit > 0 && (
                <View style={styles.stayInfoItem}>
                  <Text style={styles.stayInfoLabel}>Deposit</Text>
                  <Text style={styles.stayInfoValue}>Rs.{listing.security_deposit.toLocaleString('en-IN')}</Text>
                </View>
              )}
            </View>
          </View>

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
              {reviewsData!.reviews.slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} />)}
              {reviewsData!.total > 3 && (
                <Text style={styles.moreReviews}>+ {reviewsData!.total - 3} more review{reviewsData!.total - 3 !== 1 ? 's' : ''}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky bar ── */}
      <View style={styles.stickyBar}>
        <View>
          <Text style={styles.stickyPrice}>
            Rs.{listing.guest_price_per_night.toLocaleString('en-IN')}
            <Text style={styles.stickyPriceUnit}>/night</Text>
          </Text>
          {hasReviews && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.stickyRating}>{reviewsData!.average_rating?.toFixed(1)} · {reviewsData!.total} reviews</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.stickyBookBtn} activeOpacity={0.85} onPress={() => { setBookStep('rules'); setShowBookModal(true); }}>
          <Text style={styles.stickyBookBtnText}>Book now</Text>
        </TouchableOpacity>
      </View>

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
                  {listing.house_rules.no_smoking && (
                    <View style={styles.modalRuleRow}><Ionicons name="close-circle" size={20} color={COLORS.danger} /><Text style={styles.modalRuleText}>No smoking</Text></View>
                  )}
                  {listing.house_rules.no_pets && (
                    <View style={styles.modalRuleRow}><Ionicons name="paw" size={20} color={COLORS.danger} /><Text style={styles.modalRuleText}>No pets</Text></View>
                  )}
                  {listing.house_rules.no_alcohol && (
                    <View style={styles.modalRuleRow}><Ionicons name="wine" size={20} color={COLORS.danger} /><Text style={styles.modalRuleText}>No alcohol in common areas</Text></View>
                  )}
                  {listing.house_rules.custom_rules && (
                    <View style={styles.modalCustomRules}><Ionicons name="document-text-outline" size={16} color={COLORS.textSec} style={{ marginBottom: 4 }} /><Text style={styles.modalCustomRulesText}>{listing.house_rules.custom_rules}</Text></View>
                  )}
                  {!listing.house_rules.no_smoking && !listing.house_rules.no_pets && !listing.house_rules.no_alcohol && !listing.house_rules.custom_rules && (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  photoCounterTxt: { fontSize: 12, color: '#fff', ...FONTS.medium },

  body: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },

  titleBlock: { marginBottom: SPACING.lg },
  title: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: 6, lineHeight: 30 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginBottom: 12, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF3C7', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  ratingPillTxt: { fontSize: 13, ...FONTS.semibold, color: '#92400E' },
  ratingPillCount: { fontSize: 12, color: '#B45309', ...FONTS.regular },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,129,0.10)', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedTxt: { fontSize: 12, ...FONTS.semibold, color: '#047857' },
  instantPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,184,0,0.12)', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  instantTxt: { fontSize: 12, ...FONTS.semibold, color: '#92400E' },

  section: { marginBottom: SPACING.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: COLORS.primary },
  sectionTitle: { fontSize: 17, ...FONTS.bold, color: COLORS.text },
  description: { fontSize: 14, color: COLORS.textSec, lineHeight: 22 },

  flatmateCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  flatmateAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  flatmateInitials: { fontSize: 15, ...FONTS.bold, color: COLORS.primary },
  flatmateName: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  flatmateDetail: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  hostBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha },
  hostBadgeText: { fontSize: 10, ...FONTS.semibold, color: COLORS.primary },

  foodChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryAlpha, borderWidth: 1, borderColor: 'rgba(13,115,119,0.15)' },
  foodChipText: { fontSize: 13, color: COLORS.primary, ...FONTS.medium },
  foodDesc: { fontSize: 13, color: COLORS.textSec, lineHeight: 20 },

  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  amenityRow: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  amenityText: { fontSize: 14, color: COLORS.text, flex: 1 },

  spaceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.sm },
  spaceCard: { width: (SCREEN_W - SPACING.lg * 2 - 10) / 2, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  spaceCardIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  spaceCardLabel: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  spaceCardSub: { fontSize: 12, color: COLORS.textSec },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featureChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  featureChipText: { fontSize: 12, color: COLORS.textSec },

  miniMapWrap: { borderRadius: RADIUS.lg, overflow: 'hidden', height: 180, marginBottom: 6 },
  miniMap: { width: '100%', height: 180 },
  locationDisclaimer: { fontSize: 12, color: COLORS.textMut, textAlign: 'center' },

  checkinRow: { flexDirection: 'row', gap: SPACING.sm },
  checkinCard: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', gap: 6 },
  checkinLabel: { fontSize: 12, color: COLORS.textSec },
  checkinTime: { fontSize: 16, ...FONTS.bold, color: COLORS.text },

  stayInfoRow: { flexDirection: 'row', gap: SPACING.sm },
  stayInfoItem: { flex: 1, alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  stayInfoLabel: { fontSize: 11, color: COLORS.textMut, marginBottom: 4, ...FONTS.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  stayInfoValue: { fontSize: 15, ...FONTS.bold, color: COLORS.text },

  reviewsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  breakdownWrap: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { width: 116, fontSize: 13, color: COLORS.textSec },
  breakdownTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  breakdownFill: { height: 5, borderRadius: 3, backgroundColor: '#F59E0B' },
  breakdownVal: { width: 30, fontSize: 13, ...FONTS.semibold, color: COLORS.text, textAlign: 'right' },
  reviewCard: { backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  reviewCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryAlpha, alignItems: 'center', justifyContent: 'center' },
  reviewerInitials: { fontSize: 14, ...FONTS.bold, color: COLORS.primary },
  reviewerName: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  reviewDate: { fontSize: 12, color: COLORS.textMut, marginTop: 1 },
  reviewTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  reviewBody: { fontSize: 14, color: COLORS.textSec, lineHeight: 21 },
  hostReply: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  hostReplyLabel: { fontSize: 12, ...FONTS.semibold, color: COLORS.text, marginBottom: 4 },
  hostReplyBody: { fontSize: 13, color: COLORS.textSec, lineHeight: 19 },
  moreReviews: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold, textAlign: 'center', paddingVertical: SPACING.sm },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingBottom: 30, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.md },
  stickyPrice: { fontSize: 22, ...FONTS.bold, color: COLORS.text },
  stickyPriceUnit: { fontSize: 13, ...FONTS.regular, color: COLORS.textSec },
  stickyRating: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  stickyBookBtn: { backgroundColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: RADIUS.pill, ...SHADOW.sm },
  stickyBookBtnText: { color: '#fff', fontSize: 16, ...FONTS.bold },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  rulesIntro: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.md },
  rulesScroll: { marginBottom: SPACING.md },
  modalRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalRuleText: { fontSize: 15, color: COLORS.text, ...FONTS.medium },
  modalCustomRules: { backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, padding: SPACING.md, marginTop: SPACING.sm },
  modalCustomRulesText: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },
  noRulesText: { fontSize: 14, color: COLORS.textMut, paddingVertical: SPACING.md },
  modalTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  calendarHint: { fontSize: 14, color: COLORS.primary, ...FONTS.medium, textAlign: 'center', marginBottom: SPACING.sm },
  modalHint: { fontSize: 12, color: COLORS.textMut, marginTop: SPACING.sm },
  modalBtn: { backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: RADIUS.pill, alignItems: 'center', marginTop: SPACING.md },
  modalBtnDisabled: { backgroundColor: COLORS.border },
  modalBtnText: { color: '#fff', fontSize: 16, ...FONTS.bold },
});
