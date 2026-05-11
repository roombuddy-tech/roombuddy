import { Ionicons } from '@expo/vector-icons';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../constants/theme';
import type { GuestStackParamList } from '../../navigation/types';
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

function Divider() {
  return <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md }} />;
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function getDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function GuestListingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { listingId } = route.params;

  const [listing, setListing] = useState<GuestListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const [showBookModal, setShowBookModal] = useState(false);
  const [bookStep, setBookStep] = useState<'rules' | 'dates'>('rules');
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);

  const onDayPress = (day: DateData) => {
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(day.dateString);
      setCheckOut(null);
    } else {
      if (day.dateString <= checkIn) {
        setCheckIn(day.dateString);
        setCheckOut(null);
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

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const cur = new Date(start);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      const isStart = key === checkIn;
      const isEnd = key === checkOut;
      marks[key] = {
        startingDay: isStart,
        endingDay: isEnd,
        color: isStart || isEnd ? COLORS.primary : COLORS.primaryAlpha,
        textColor: isStart || isEnd ? '#fff' : COLORS.primary,
      };
      cur.setDate(cur.getDate() + 1);
    }
    return marks;
  };

  useEffect(() => {
    getGuestListingDetail(listingId)
      .then((data) => setListing(data))
      .catch(() => setError('Could not load listing'))
      .finally(() => setLoading(false));
  }, [listingId]);

  const onPhotoScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActivePhotoIdx(idx);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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
      listingId: listing.listing_id,
      listingTitle: listing.title,
      checkIn,
      checkOut,
      mealsAvailable: listing.food.meals_available,
      mealCostPerDay: listing.food.meal_cost,
      mealTypes: listing.food.meal_types,
      mealDescription: listing.food.meal_description,
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Photo carousel */}
        <View style={styles.photoWrap}>
          {photoUrls.length > 0 ? (
            <FlatList
              data={photoUrls}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onPhotoScroll}
              scrollEventThrottle={16}
              renderItem={({ item: uri }) => (
                <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
              )}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={{ fontSize: 60 }}>🏠</Text>
            </View>
          )}

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          {photoUrls.length > 0 && (
            <View style={styles.photoCounter}>
              <Ionicons name="camera-outline" size={13} color="#fff" />
              <Text style={styles.photoCounterTxt}>
                {photoUrls.length} photo{photoUrls.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.subtitle}>{subtitleParts.join(' · ')}</Text>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={styles.badgeText}>Verified</Text>
            </View>
            {listing.booking_mode === 'instant' && (
              <View style={styles.badge}>
                <Ionicons name="flash" size={14} color={COLORS.star} />
                <Text style={styles.badgeText}>Instant book</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {listing.description ? (
            <>
              <Divider />
              <Text style={styles.sectionTitle}>About this room</Text>
              <Text style={styles.description}>
                {listing.description.replace(/\n{2,}/g, '\n').trim()}
              </Text>
            </>
          ) : null}

          {/* Flatmates */}
          {listing.flatmates.length > 0 && (
            <>
              <Divider />
              <Text style={styles.sectionTitle}>👥 Meet your flatmates</Text>

              {listing.host_info && (listing.host_info.occupation || listing.host_info.hobbies) && (
                <View style={styles.flatmateCard}>
                  <View style={styles.flatmateAvatar}>
                    <Text style={styles.flatmateInitials}>
                      {listing.host_name ? initials(listing.host_name) : 'H'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.flatmateName}>{listing.host_name || 'Host'}</Text>
                      <View style={styles.hostBadge}>
                        <Text style={styles.hostBadgeText}>Host</Text>
                      </View>
                    </View>
                    {listing.host_info.occupation ? (
                      <Text style={styles.flatmateDetail}>{listing.host_info.occupation}</Text>
                    ) : null}
                    {listing.host_info.hobbies ? (
                      <Text style={styles.flatmateDetail}>{listing.host_info.hobbies}</Text>
                    ) : null}
                    {listing.host_info.native_town ? (
                      <Text style={styles.flatmateDetail}>From {listing.host_info.native_town}</Text>
                    ) : null}
                  </View>
                </View>
              )}

              {listing.flatmates.map((fm, idx) => (
                <View key={idx} style={[styles.flatmateCard, idx === listing.flatmates.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.flatmateAvatar}>
                    <Text style={styles.flatmateInitials}>{initials(fm.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flatmateName}>
                      {fm.name}{fm.age ? `, ${fm.age}` : ''}
                    </Text>
                    {fm.occupation ? (
                      <Text style={styles.flatmateDetail}>{fm.occupation}</Text>
                    ) : null}
                    {fm.hobbies ? (
                      <Text style={styles.flatmateDetail}>{fm.hobbies}</Text>
                    ) : null}
                    {fm.native_town ? (
                      <Text style={styles.flatmateDetail}>From {fm.native_town}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Food options */}
          {(listing.food.kitchen_access || listing.food.meals_available) && (
            <>
              <Divider />
              <Text style={styles.sectionTitle}>🍳 Food options</Text>
              <View style={styles.foodChipRow}>
                {listing.food.kitchen_access && (
                  <View style={styles.foodChip}>
                    <Text style={styles.foodChipText}>Kitchen access</Text>
                  </View>
                )}
                {listing.food.meals_available && listing.food.meal_cost !== null && (
                  <View style={styles.foodChip}>
                    <Text style={styles.foodChipText}>
                      Tiffin ₹{listing.food.meal_cost}/meal
                    </Text>
                  </View>
                )}
                {listing.amenities.find((a) => a.display_name === 'Utensils provided') && (
                  <View style={styles.foodChip}>
                    <Text style={styles.foodChipText}>Utensils provided</Text>
                  </View>
                )}
              </View>
              {listing.food.meal_description ? (
                <Text style={styles.foodDesc}>{listing.food.meal_description}</Text>
              ) : null}
            </>
          )}

          {/* Amenities */}
          {listing.amenities.length > 0 && (
            <>
              <Divider />
              <Text style={styles.sectionTitle}>✨ Amenities</Text>
              <View style={styles.amenityGrid}>
                {listing.amenities.map((a) => (
                  <View key={a.display_name} style={styles.amenityRow}>
                    <Ionicons
                      name={(AMENITY_ICONS[a.display_name] ?? 'checkmark-outline') as any}
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.amenityText}>{a.display_name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* The space */}
          <Divider />
          <Text style={styles.sectionTitle}>The space</Text>
          <View style={styles.spaceGrid}>
            <View style={styles.spaceCard}>
              <Ionicons name="home-outline" size={22} color={COLORS.primary} />
              <Text style={styles.spaceCardLabel}>{listing.property.apartment_type}</Text>
              {listing.property.floor_number > 0 && (
                <Text style={styles.spaceCardSub}>Floor {listing.property.floor_number}</Text>
              )}
            </View>
            <View style={styles.spaceCard}>
              <Ionicons name="bed-outline" size={22} color={COLORS.primary} />
              <Text style={styles.spaceCardLabel}>
                {listing.room.room_type === 'private' ? 'Private room' : 'Shared room'}
              </Text>
              {listing.room.bed_type && (
                <Text style={styles.spaceCardSub}>
                  {listing.room.bed_type.charAt(0).toUpperCase() + listing.room.bed_type.slice(1)} bed
                </Text>
              )}
            </View>
            <View style={styles.spaceCard}>
              <Ionicons name="water-outline" size={22} color={COLORS.primary} />
              <Text style={styles.spaceCardLabel}>
                {listing.room.bathroom_type === 'attached' ? 'Attached bath' : 'Shared bath'}
              </Text>
            </View>
            {listing.room.room_size_sqft && (
              <View style={styles.spaceCard}>
                <Ionicons name="expand-outline" size={22} color={COLORS.primary} />
                <Text style={styles.spaceCardLabel}>{listing.room.room_size_sqft} sq ft</Text>
              </View>
            )}
          </View>

          {listing.room.room_features.length > 0 && (
            <View style={styles.featureRow}>
              {listing.room.room_features.map((f) => (
                <View key={f} style={styles.featureChip}>
                  <Text style={styles.featureChipText}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Check-in / Check-out */}
          {(listing.check_in_from || listing.check_out_by) && (
            <>
              <Divider />
              <Text style={styles.sectionTitle}>Check-in / Check-out</Text>
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
            </>
          )}

          {/* Stay info */}
          <Divider />
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
                <Text style={styles.stayInfoValue}>₹{listing.security_deposit.toLocaleString('en-IN')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.stickyBar}>
        <View>
          <Text style={styles.stickyPrice}>
            ₹{listing.guest_price_per_night.toLocaleString('en-IN')}
            <Text style={styles.stickyPriceUnit}>/night</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.stickyBookBtn} activeOpacity={0.85} onPress={() => { setBookStep('rules'); setShowBookModal(true); }}>
          <Text style={styles.stickyBookBtnText}>Book now</Text>
        </TouchableOpacity>
      </View>

      {/* Booking modal — Step 1: House rules, Step 2: Dates */}
      <Modal visible={showBookModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {bookStep === 'rules' ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>House rules</Text>
                  <TouchableOpacity onPress={() => setShowBookModal(false)}>
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.rulesIntro}>
                  Please review the house rules before booking
                </Text>

                <ScrollView style={styles.rulesScroll} showsVerticalScrollIndicator={false}>
                  {listing.house_rules.no_smoking && (
                    <View style={styles.modalRuleRow}>
                      <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                      <Text style={styles.modalRuleText}>No smoking</Text>
                    </View>
                  )}
                  {listing.house_rules.no_pets && (
                    <View style={styles.modalRuleRow}>
                      <Ionicons name="paw" size={20} color={COLORS.danger} />
                      <Text style={styles.modalRuleText}>No pets</Text>
                    </View>
                  )}
                  {listing.house_rules.no_alcohol && (
                    <View style={styles.modalRuleRow}>
                      <Ionicons name="wine" size={20} color={COLORS.danger} />
                      <Text style={styles.modalRuleText}>No alcohol in common areas</Text>
                    </View>
                  )}
                  {listing.house_rules.custom_rules && (
                    <View style={styles.modalCustomRules}>
                      <Ionicons name="document-text-outline" size={16} color={COLORS.textSec} style={{ marginBottom: 4 }} />
                      <Text style={styles.modalCustomRulesText}>{listing.house_rules.custom_rules}</Text>
                    </View>
                  )}
                  {!listing.house_rules.no_smoking && !listing.house_rules.no_pets && !listing.house_rules.no_alcohol && !listing.house_rules.custom_rules && (
                    <Text style={styles.noRulesText}>No specific house rules</Text>
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.modalBtn} onPress={() => setBookStep('dates')} activeOpacity={0.85}>
                  <Text style={styles.modalBtnText}>I agree, continue</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setBookStep('rules')}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select dates</Text>
                  <TouchableOpacity onPress={() => setShowBookModal(false)}>
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.calendarHint}>
                  {!checkIn ? 'Select check-in date' : !checkOut ? 'Select check-out date' : `${checkIn}  →  ${checkOut}`}
                </Text>

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
                  }}
                />

                {(() => {
                  const selectedNights = checkIn && checkOut
                    ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
                    : 0;
                  const tooShort = checkIn && checkOut && selectedNights < listing.min_nights;
                  const canContinue = checkIn && checkOut && !tooShort;
                  return (
                    <>
                      {listing.min_nights > 1 && (
                        <Text style={[styles.modalHint, tooShort ? { color: COLORS.danger } : undefined]}>
                          {tooShort
                            ? `Minimum stay is ${listing.min_nights} nights (you selected ${selectedNights})`
                            : `Minimum stay: ${listing.min_nights} nights`}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[styles.modalBtn, !canContinue && styles.modalBtnDisabled]}
                        onPress={handleBookNow}
                        activeOpacity={0.85}
                        disabled={!canContinue}
                      >
                        <Text style={styles.modalBtnText}>Continue to booking</Text>
                      </TouchableOpacity>
                    </>
                  );
                })()}
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

  photoWrap: { position: 'relative', width: SCREEN_W, height: 240, backgroundColor: COLORS.warm },
  photo: { width: SCREEN_W, height: 240 },
  photoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    position: 'absolute', top: 12, left: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  photoCounter: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  photoCounterTxt: { fontSize: 12, color: '#fff', ...FONTS.medium },

  body: { padding: SPACING.lg },

  title: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.sm },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
  },
  badgeText: { fontSize: 12, ...FONTS.medium, color: COLORS.text },

  priceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  price: { fontSize: 22, ...FONTS.bold, color: COLORS.text },
  priceUnit: { fontSize: 14, ...FONTS.regular, color: COLORS.textSec },
  bookBtn: {
    backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: RADIUS.md,
  },
  bookBtnText: { color: '#fff', fontSize: 15, ...FONTS.semibold },

  sectionTitle: { fontSize: 17, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },
  description: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },

  flatmateCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  flatmateAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center', alignItems: 'center',
  },
  flatmateInitials: { fontSize: 14, ...FONTS.bold, color: COLORS.primary },
  flatmateName: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  flatmateDetail: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  hostBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryAlpha, borderWidth: 1, borderColor: COLORS.primary,
  },
  hostBadgeText: { fontSize: 10, ...FONTS.semibold, color: COLORS.primary },

  foodChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foodChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.md, backgroundColor: COLORS.primaryAlpha,
  },
  foodChipText: { fontSize: 13, color: COLORS.primary, ...FONTS.medium },
  foodDesc: { fontSize: 13, color: COLORS.textSec, marginTop: SPACING.sm, lineHeight: 20 },

  amenityGrid: { gap: 4 },
  amenityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  amenityText: { fontSize: 14, color: COLORS.text },

  spaceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  spaceCard: {
    width: '47%', padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  spaceCardLabel: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  spaceCardSub: { fontSize: 12, color: COLORS.textSec },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  featureChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.pill, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  featureChipText: { fontSize: 12, color: COLORS.textSec },


  checkinRow: { flexDirection: 'row', gap: SPACING.sm },
  checkinCard: {
    flex: 1, padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', gap: 4,
  },
  checkinLabel: { fontSize: 12, color: COLORS.textSec },
  checkinTime: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },

  stayInfoRow: { flexDirection: 'row', gap: SPACING.md },
  stayInfoItem: { flex: 1, alignItems: 'center' },
  stayInfoLabel: { fontSize: 12, color: COLORS.textSec, marginBottom: 4 },
  stayInfoValue: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },

  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingBottom: 32,
    backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  stickyPrice: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  stickyPriceUnit: { fontSize: 13, ...FONTS.regular, color: COLORS.textSec },
  stickyBookBtn: {
    backgroundColor: COLORS.accent, paddingVertical: 13, paddingHorizontal: 28,
    borderRadius: RADIUS.md,
  },
  stickyBookBtnText: { color: '#fff', fontSize: 15, ...FONTS.semibold },

  modalOverlay: {
    flex: 1, backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: 40, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
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
  modalBtn: {
    backgroundColor: COLORS.accent, paddingVertical: 16,
    borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.md,
  },
  modalBtnDisabled: { backgroundColor: COLORS.border },
  modalBtnText: { color: '#fff', fontSize: 16, ...FONTS.bold },
});
