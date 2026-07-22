import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, DateData } from 'react-native-calendars';
import { FONTS, SPACING, RADIUS, SHADOW, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';
import { CONFIG } from '../../constants/config';
import type { HostStackParamList } from '../../navigation/types';
import { getListing, updateBlockedDates, deleteListing, toggleSnooze } from '../../services/listings';
import { getListingReviews, type ListingReviewsResponse, type ReviewItem } from '../../services/reviews';

type Nav = NativeStackNavigationProp<HostStackParamList, 'ListingDetail'>;
type Route = RouteProp<HostStackParamList, 'ListingDetail'>;

const { width: SCREEN_W } = Dimensions.get('window');

const AMENITY_ICONS: Record<string, any> = {
  'WiFi': 'wifi-outline',
  'AC': 'snow-outline',
  'Geyser / Hot water': 'water-outline',
  'Power backup': 'battery-charging-outline',
  'Washing machine': 'refresh-circle-outline',
  'Iron': 'shirt-outline',
  'Hair dryer': 'color-wand-outline',
  'Full kitchen access': 'restaurant-outline',
  'Fridge': 'cube-outline',
  'Microwave': 'radio-outline',
  'Gas stove': 'flame-outline',
  'RO / Water purifier': 'filter-outline',
  'Utensils provided': 'cafe-outline',
  'TV': 'tv-outline',
  'Sofa / Common area': 'people-outline',
  'Workspace / Desk': 'desktop-outline',
  'Terrace / Garden access': 'leaf-outline',
  'Parking (2-wheeler)': 'bicycle-outline',
  'Parking (4-wheeler)': 'car-outline',
  'Lift / Elevator': 'arrow-up-circle-outline',
  'CCTV (common areas)': 'camera-outline',
  'Security guard': 'shield-checkmark-outline',
  'Fire extinguisher': 'warning-outline',
  'First aid kit': 'medkit-outline',
  'Door lock on room': 'lock-closed-outline',
};

export default function ListingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { preview, item } = route.params ?? {};
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const Divider = () => (
    <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md }} />
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionHeader}>{title}</Text>
    </View>
  );

  const isPreview = !!preview;
  const f = preview;

  const [fetchedPhotos, setFetchedPhotos] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<Array<{ start_date: string; end_date: string }>>([]);
  const [savedDates, setSavedDates] = useState<Array<{ start_date: string; end_date: string }>>([]);
  const [selectingStart, setSelectingStart] = useState<string | null>(null);
  const [savingDates, setSavingDates] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [listingStatus, setListingStatus] = useState<string>(item?.status ?? 'live');
  const [togglingSnooze, setTogglingSnooze] = useState(false);
  const [reviewsData, setReviewsData] = useState<ListingReviewsResponse | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);


  const StarDisplay = ({ rating }: { rating: number }) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
      ))}
    </View>
  );

  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
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
            <Text style={styles.hostReplyLabel}>Your response</Text>
            <Text style={styles.hostReplyBody}>{review.host_response}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const BREAKDOWN_LABELS: Record<string, string> = {
    cleanliness: 'Cleanliness',
    accuracy: 'Accuracy',
    communication: 'Communication',
    location: 'Location',
    value: 'Value for money',
    food: 'Food & Kitchen',
  };

  const breakdownEntries = reviewsData
    ? (Object.entries(reviewsData.breakdown).filter(([, v]) => v != null) as [string, number][])
    : [];

  const hasUnsavedDates = JSON.stringify(blockedDates) !== JSON.stringify(savedDates);

  useFocusEffect(
    useCallback(() => {
      if (!isPreview && item?.listing_id) {
        getListing(item.listing_id)
          .then((data: any) => {
            const all = Object.values(data.photos as Record<string, string[]>).flat();
            setFetchedPhotos(all);
            const dates = data.blocked_dates || [];
            setBlockedDates(dates);
            setSavedDates(dates);
            if (data.status) setListingStatus(data.status);
          })
          .catch(() => {});
        getListingReviews(item.listing_id).then(setReviewsData).catch(() => {});
      }
    }, [item?.listing_id, isPreview]),
  );

  const today = new Date().toISOString().split('T')[0];

  const onDayPress = (day: DateData) => {
    if (day.dateString < today) return;
    if (!selectingStart) {
      setSelectingStart(day.dateString);
    } else if (selectingStart === day.dateString) {
      // Tapped same date twice — cancel selection
      setSelectingStart(null);
    } else {
      const start = selectingStart < day.dateString ? selectingStart : day.dateString;
      const end = selectingStart < day.dateString ? day.dateString : selectingStart;
      // Avoid adding overlapping ranges
      setBlockedDates((prev) => {
        const overlaps = prev.some(r => start <= r.end_date && end >= r.start_date);
        if (overlaps) {
          Alert.alert('Already blocked', 'This range overlaps with dates already blocked.');
          return prev;
        }
        return [...prev, { start_date: start, end_date: end }];
      });
      setSelectingStart(null);
    }
  };

  const removeRange = (index: number) => {
    setBlockedDates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBlockedDates = async () => {
    if (!item?.listing_id) return;
    setSavingDates(true);
    try {
      await updateBlockedDates(item.listing_id, blockedDates);
      setSavedDates(blockedDates);
      Alert.alert('Saved', 'Availability updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to update availability. Please try again.');
    } finally {
      setSavingDates(false);
    }
  };

  const handleToggleSnooze = async () => {
    if (!item?.listing_id) return;
    setTogglingSnooze(true);
    try {
      const result = await toggleSnooze(item.listing_id);
      setListingStatus(result.status);
    } catch {
      Alert.alert('Error', 'Failed to update listing status. Please try again.');
    } finally {
      setTogglingSnooze(false);
    }
  };

  const handleDeleteListing = () => {
    if (!item?.listing_id) return;
    Alert.alert(
      'Delete listing',
      'Are you sure you want to permanently delete this listing? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteListing(item.listing_id);
              Alert.alert('Deleted', 'Your listing has been removed.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch {
              Alert.alert('Error', 'Failed to delete listing. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const getMarkedDates = () => {
    const marks: Record<string, any> = {};
    if (selectingStart) {
      marks[selectingStart] = { startingDay: true, endingDay: true, color: COLORS.primary, textColor: '#fff' };
    }
    for (const range of blockedDates) {
      const s = new Date(range.start_date);
      const e = new Date(range.end_date);
      const cur = new Date(s);
      while (cur <= e) {
        const key = cur.toISOString().split('T')[0];
        marks[key] = {
          color: '#FECACA',
          textColor: '#991B1B',
          startingDay: key === range.start_date,
          endingDay: key === range.end_date,
        };
        cur.setDate(cur.getDate() + 1);
      }
    }
    return marks;
  };

  // Derive display data from preview form or from list item
  const title = f?.title || item?.title || 'Listing';
  const areaName = f ? `${f.locality}${f.city ? `, ${f.city}` : ''}` : (item?.area_name ?? '');
  const hostPrice = f ? (parseInt(f.nightlyRate, 10) || 0) : (item?.host_price_per_night ?? 0);
  const guestPrice = f ? hostPrice : (item?.guest_price_per_night ?? 0);

  const allPhotos: string[] = f
    ? Object.values((f.photos ?? {}) as Record<string, string[]>).flat().filter(Boolean)
    : fetchedPhotos.length > 0
      ? fetchedPhotos
      : item?.cover_photo_url
        ? [item.cover_photo_url]
        : [];

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActivePhotoIdx(idx);
  };

  const tags: string[] = [];
  if (f?.roomType === 'private') tags.push('Private room');
  else if (f?.roomType === 'shared') tags.push('Shared room');
  if (f?.amenities?.includes('AC')) tags.push('AC');
  if (f?.amenities?.includes('WiFi')) tags.push('WiFi');
  if (f?.kitchenAccess || f?.amenities?.includes('Full kitchen access')) tags.push('Kitchen');

  const aptLabel: Record<string, string> = {
    '1BHK': '1 BHK', '2BHK': '2 BHK', '3BHK': '3 BHK', '4BHK+': '4 BHK+ / Villa',
  };

  const bedLabel = (bed: string) =>
    bed ? bed.charAt(0).toUpperCase() + bed.slice(1) + ' bed' : '';

  const bathroomLabel = (b: string) => (b === 'attached' ? 'Attached bathroom' : b === 'shared' ? 'Shared bathroom' : '');

  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

  const previewSubtitle = isPreview && f ? [
    f.city || f.locality,
    f.bedType ? `${f.bedType.charAt(0).toUpperCase()}${f.bedType.slice(1)} bed` : null,
    (f.amenities as string[])?.includes('AC') ? 'AC' : null,
    f.bathroom === 'attached' ? 'Attached bath' : f.bathroom === 'shared' ? 'Shared bath' : null,
  ].filter(Boolean).join(' · ') : '';

  const minStayNightsMap: Record<string, number> = {
    '1_night': 1, '2_nights': 2, '3_nights': 3, '1_week': 7, '2_weeks': 14, '1_month': 30,
  };
  const previewMinNights = f?.minStay ? (minStayNightsMap[f.minStay] ?? 1) : 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Preview banner */}
      {isPreview && (
        <View style={styles.previewBanner}>
          <Ionicons name="eye-outline" size={14} color="#92400E" />
          <Text style={styles.previewBannerTxt}>Preview — this is how guests will see your listing</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Photos carousel */}
        <View style={styles.photoWrap}>
          {allPhotos.length > 0 ? (
            <FlatList
              data={allPhotos}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onPhotoScroll}
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
              initialNumToRender={1}
              windowSize={3}
              removeClippedSubviews={false}
              renderItem={({ item: uri, index }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => { setActivePhotoIdx(index); setShowPhotoGallery(true); }}>
                  <Image
                    source={{ uri }}
                    style={styles.coverPhoto}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="home-outline" size={48} color={COLORS.textMut} />
            </View>
          )}

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>

          {allPhotos.length > 0 && isPreview ? (
            <View style={styles.photoCounter}>
              <Ionicons name="camera-outline" size={13} color="#fff" />
              <Text style={styles.photoCounterTxt}>
                {allPhotos.length} photo{allPhotos.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : allPhotos.length > 1 && !isPreview ? (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterTxt}>
                {activePhotoIdx + 1} / {allPhotos.length}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {isPreview && f ? (
            <>
              {/* ── Title & location ── */}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{previewSubtitle}</Text>

              {/* Badges */}
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                  <Text style={styles.badgeText}>Verified</Text>
                </View>
              </View>

              {/* ── About this room ── */}
              {f.description ? (
                <>
                  <Divider />
                  <SectionHeader title="About this room" />
                  <Text style={styles.description}>
                    {f.description.replace(/\n{2,}/g, '\n').trim()}
                  </Text>
                </>
              ) : null}

              {/* ── The space ── */}
              {(f.apartmentType || f.roomType) && (
                <>
                  <Divider />
                  <SectionHeader title="The space" />
                  {f.apartmentName ? (
                    <View style={styles.apartmentNameRow}>
                      <Ionicons name="business-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.apartmentNameTxt}>{f.apartmentName}</Text>
                    </View>
                  ) : null}
                  <View style={styles.spaceList}>
                    {f.apartmentType ? (
                      <View style={styles.spaceRow}>
                        <View style={styles.spaceRowIconWrap}>
                          <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View>
                          <Text style={styles.spaceRowLabel}>{aptLabel[f.apartmentType] || f.apartmentType}</Text>
                          <Text style={styles.spaceRowSub}>Apartment type</Text>
                        </View>
                      </View>
                    ) : null}
                    {f.roomType ? (
                      <View style={styles.spaceRow}>
                        <View style={styles.spaceRowIconWrap}>
                          <MaterialCommunityIcons
                            name={f.roomType === 'private' ? 'door-closed-lock' : 'bunk-bed-outline'}
                            size={18}
                            color={COLORS.primary}
                          />
                        </View>
                        <View>
                          <Text style={styles.spaceRowLabel}>
                            {f.roomType === 'private' ? 'Private room' : 'Shared room'}
                            {f.bedType ? ` · ${bedLabel(f.bedType)}` : ''}
                          </Text>
                          <Text style={styles.spaceRowSub}>Room type</Text>
                        </View>
                      </View>
                    ) : null}
                    {f.bathroom ? (
                      <View style={styles.spaceRow}>
                        <View style={styles.spaceRowIconWrap}>
                          <Ionicons name="water-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View>
                          <Text style={styles.spaceRowLabel}>{bathroomLabel(f.bathroom)}</Text>
                          <Text style={styles.spaceRowSub}>Bathroom</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  {f.roomFeatures && f.roomFeatures.length > 0 && (
                    <>
                      <Text style={styles.subSectionLabel}>What this room has</Text>
                      <View style={styles.featureRow}>
                        {f.roomFeatures.map((feat: string) => (
                          <View key={feat} style={styles.featureChip}>
                            <Ionicons name="checkmark-outline" size={13} color={COLORS.primary} />
                            <Text style={styles.featureChipTxt}>{feat}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}

              {/* ── Nearby landmarks ── */}
              {f.nearbyLandmarks && f.nearbyLandmarks.length > 0 && (
                <>
                  <Divider />
                  <SectionHeader title="Nearby" />
                  <View style={styles.nearbyWrap}>
                    {f.nearbyLandmarks.map((lm: string, i: number) => (
                      <View key={i} style={styles.nearbyChip}>
                        <Ionicons name="location" size={13} color={COLORS.primary} />
                        <Text style={styles.nearbyChipText}>
                          {lm}{i === 0 && f.distanceToLandmark ? ` (${f.distanceToLandmark} min walk)` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* ── Meet your flatmates ── */}
              {(f.flatmates?.length > 0 || f.hostOccupation || f.hostHobbies || f.hostAge || f.hostGender || f.hostHometown) && (
                <>
                  <Divider />
                  <SectionHeader title="Meet your flatmates" />
                  {(f.hostOccupation || f.hostHobbies || f.hostAge || f.hostGender || f.hostHometown) && (
                    <View style={styles.flatmateCard}>
                      <View style={styles.flatmateAvatar}>
                        <Text style={styles.flatmateInitials}>H</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.flatmateName}>
                            Host{f.hostAge ? `, ${f.hostAge}` : ''}
                          </Text>
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeTxt}>Host</Text>
                          </View>
                        </View>
                        {f.hostGender ? <Text style={styles.flatmateDetail}>{f.hostGender.charAt(0).toUpperCase() + f.hostGender.slice(1)}</Text> : null}
                        {f.hostOccupation ? <Text style={styles.flatmateDetail}>{f.hostOccupation}</Text> : null}
                        {f.hostHobbies ? <Text style={styles.flatmateDetail}>Hobbies: {f.hostHobbies}</Text> : null}
                        {f.hostHometown ? <Text style={styles.flatmateDetail}>From {f.hostHometown}</Text> : null}
                      </View>
                    </View>
                  )}
                  {(f.flatmates as any[]).map((fm: any, idx: number) => (
                    <View key={fm.id ?? idx} style={[styles.flatmateCard, idx === f.flatmates.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.flatmateAvatar}>
                        <Text style={styles.flatmateInitials}>{initials(fm.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.flatmateName}>
                          {fm.name}{fm.age ? `, ${fm.age}` : ''}
                        </Text>
                        {fm.gender ? <Text style={styles.flatmateDetail}>{fm.gender.charAt(0).toUpperCase() + fm.gender.slice(1)}</Text> : null}
                        {fm.occupation ? <Text style={styles.flatmateDetail}>{fm.occupation}</Text> : null}
                        {fm.hobbies ? <Text style={styles.flatmateDetail}>Hobbies: {fm.hobbies}</Text> : null}
                        {fm.hometown ? <Text style={styles.flatmateDetail}>From {fm.hometown}</Text> : null}
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* ── Food options ── */}
              {(f.kitchenAccess || f.homeCooked) && (
                <>
                  <Divider />
                  <SectionHeader title="Food options" />
                  <View style={styles.foodChipRow}>
                    {f.kitchenAccess && (
                      <View style={styles.foodChip}>
                        <Ionicons name="restaurant-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.foodChipText}>Kitchen access</Text>
                      </View>
                    )}
                    {f.homeCooked && f.mealCost ? (
                      <View style={styles.foodChip}>
                        <Ionicons name="fast-food-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.foodChipText}>
                          Home meals · ₹{f.mealCost}/day
                          {f.mealTypes && (f.mealTypes as string[]).length > 0 ? ` · ${(f.mealTypes as string[]).join(', ')}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {f.mealDescription ? <Text style={styles.foodDesc}>{f.mealDescription}</Text> : null}
                </>
              )}

              {/* ── Amenities (grouped) ── */}
              {f.amenities && f.amenities.length > 0 && (() => {
                const ams = f.amenities as string[];
                const groups: Array<{ label: string; icon: string; items: string[] }> = [
                  {
                    label: 'Essentials',
                    icon: 'flash-outline',
                    items: ['WiFi', 'AC', 'Geyser / Hot water', 'Power backup', 'Washing machine', 'Iron', 'Hair dryer'].filter(a => ams.includes(a)),
                  },
                  {
                    label: 'Kitchen & Food',
                    icon: 'restaurant-outline',
                    items: ['Full kitchen access', 'Fridge', 'Microwave', 'Gas stove', 'RO / Water purifier', 'Utensils provided'].filter(a => ams.includes(a)),
                  },
                  {
                    label: 'Comfort',
                    icon: 'happy-outline',
                    items: ['TV', 'Sofa / Common area', 'Workspace / Desk', 'Terrace / Garden access', 'Parking (2-wheeler)', 'Parking (4-wheeler)', 'Lift / Elevator'].filter(a => ams.includes(a)),
                  },
                  {
                    label: 'Safety',
                    icon: 'shield-checkmark-outline',
                    items: ['CCTV (common areas)', 'Security guard', 'Fire extinguisher', 'First aid kit', 'Door lock on room'].filter(a => ams.includes(a)),
                  },
                ].filter(g => g.items.length > 0);
                return (
                  <>
                    <Divider />
                    <SectionHeader title="What's included" />
                    {groups.map((group) => (
                      <View key={group.label} style={styles.amenityGroup}>
                        <View style={styles.amenityGroupHeader}>
                          <Ionicons name={group.icon as any} size={16} color={COLORS.primary} />
                          <Text style={styles.amenityGroupLabel}>{group.label}</Text>
                        </View>
                        <View style={styles.amenityGroupGrid}>
                          {group.items.map((a) => (
                            <View key={a} style={styles.amenityRow}>
                              <Ionicons name={(AMENITY_ICONS[a] ?? 'checkmark-outline') as any} size={16} color={COLORS.primary} />
                              <Text style={styles.amenityTxt}>{a}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </>
                );
              })()}

              {/* ── Location map (exact pin) ── */}
              {f.latitude && f.longitude && (
                <>
                  <Divider />
                  <SectionHeader title="Location" />
                  <View style={styles.miniMapWrap}>
                    <MapView
                      style={styles.miniMap}
                      provider={PROVIDER_GOOGLE}
                      initialRegion={{
                        latitude: f.latitude,
                        longitude: f.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                      scrollEnabled
                      zoomEnabled
                      rotateEnabled={false}
                      pitchEnabled={false}
                      toolbarEnabled={false}
                    >
                      <Marker coordinate={{ latitude: f.latitude, longitude: f.longitude }} />
                    </MapView>
                  </View>
                  {f.formattedAddress ? (
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={14} color={COLORS.textSec} />
                      <Text style={styles.addressTxt}>{f.formattedAddress}</Text>
                    </View>
                  ) : null}
                </>
              )}

              {/* ── House rules ── */}
              {(f.noSmoking || f.noLoudMusic || f.noPets || f.noParties || f.shoesOff || f.kitchenClean || f.noAlcohol || f.lockDoor || f.customRules) && (
                <>
                  <Divider />
                  <SectionHeader title="House rules" />
                  <View>
                    {[
                      { flag: f.noSmoking, label: 'No smoking', icon: 'close-circle-outline' },
                      { flag: f.noLoudMusic, label: 'No loud music late at night', icon: 'volume-mute-outline' },
                      { flag: f.noPets, label: 'No pets', icon: 'paw-outline' },
                      { flag: f.noParties, label: 'No parties or events', icon: 'people-circle-outline' },
                      { flag: f.shoesOff, label: 'Shoes off at the entrance', icon: 'footsteps-outline' },
                      { flag: f.kitchenClean, label: 'Keep the kitchen clean after use', icon: 'cafe-outline' },
                      { flag: f.noAlcohol, label: 'No alcohol in common areas', icon: 'wine-outline' },
                      { flag: f.lockDoor, label: 'Lock the door when leaving', icon: 'lock-closed-outline' },
                    ].filter(r => r.flag).map((rule) => (
                      <View key={rule.label} style={styles.ruleRow}>
                        <Ionicons name={rule.icon as any} size={18} color={COLORS.danger} />
                        <Text style={styles.ruleRowTxt}>{rule.label}</Text>
                      </View>
                    ))}
                  </View>
                  {f.customRules ? (
                    <View style={styles.customRuleBox}>
                      <Text style={styles.customRuleLabel}>Additional rules</Text>
                      <Text style={styles.customRuleTxt}>{f.customRules}</Text>
                    </View>
                  ) : null}
                </>
              )}

              {/* ── Check-in / Check-out & stay info ── */}
              <Divider />
              <SectionHeader title="Stay details" />
              <View style={styles.checkinRow}>
                {f.checkInTime ? (
                  <View style={styles.checkinCard}>
                    <Ionicons name="log-in-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.checkinLabel}>Check-in from</Text>
                    <Text style={styles.checkinTime}>{f.checkInTime}</Text>
                  </View>
                ) : null}
                {f.checkOutTime ? (
                  <View style={styles.checkinCard}>
                    <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.checkinLabel}>Check-out by</Text>
                    <Text style={styles.checkinTime}>{f.checkOutTime}</Text>
                  </View>
                ) : null}
                <View style={styles.checkinCard}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.checkinLabel}>Min stay</Text>
                  <Text style={styles.checkinTime}>{previewMinNights} night{previewMinNights !== 1 ? 's' : ''}</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Host management view */}
              <Text style={styles.title}>{title}</Text>
              {areaName ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textSec} />
                  <Text style={styles.locationTxt}>{areaName}</Text>
                </View>
              ) : null}

              <View style={styles.priceRow}>
                {hostPrice > 0 && (
                  <Text style={styles.price}>
                    ₹{hostPrice.toLocaleString('en-IN')}
                    <Text style={styles.priceUnit}>/night</Text>
                  </Text>
                )}
              </View>

              <Divider />

              {/* ── Reviews ── */}
              {!isPreview && reviewsData && reviewsData.total > 0 && (
                <>
                  <View style={styles.reviewsHeaderRow}>
                    <View style={styles.sectionAccent} />
                    <Ionicons name="star" size={18} color="#F59E0B" />
                    <Text style={styles.sectionHeader}>
                      {reviewsData.average_rating?.toFixed(1)}{'  ·  '}{reviewsData.total} review{reviewsData.total !== 1 ? 's' : ''}
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
                    {reviewsData.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
                  </ScrollView>
                  {reviewsData.total > reviewsData.reviews.length && (
                    <TouchableOpacity style={styles.showAllReviewsBtn} activeOpacity={0.7} onPress={() => setShowAllReviews(true)}>
                      <Text style={styles.showAllReviewsTxt}>Show all {reviewsData.total} reviews</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.text} />
                    </TouchableOpacity>
                  )}
                  <View style={{ height: SPACING.md }} />
                </>
              )}

              {/* Availability — interactive calendar */}
              {item && (
                <>
                  <SectionHeader title="Block dates" />
                  <Text style={{ fontSize: 13, color: COLORS.textSec, marginBottom: SPACING.sm }}>
                    Tap two dates to block a range — guests can't book those nights
                  </Text>
                  <Calendar
                    minDate={today}
                    markingType="period"
                    markedDates={getMarkedDates()}
                    onDayPress={onDayPress}
                    theme={{
                      todayTextColor: COLORS.primary,
                      arrowColor: COLORS.primary,
                      textDayFontFamily: FONTS.medium.fontFamily,
                      textMonthFontFamily: FONTS.semibold.fontFamily,
                      textDayHeaderFontFamily: FONTS.medium.fontFamily,
                      calendarBackground: COLORS.surface,
                      dayTextColor: COLORS.text,
                      textDisabledColor: COLORS.textMut,
                      monthTextColor: COLORS.text,
                      textDayFontSize: 13,
                      textMonthFontSize: 14,
                      textDayHeaderFontSize: 12,

                    }}
                    style={{ borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 0, backgroundColor: COLORS.surface }}
                  />

                  {selectingStart && (
                    <Text style={{ fontSize: 13, color: COLORS.primary, marginTop: SPACING.sm, ...FONTS.medium }}>
                      Now tap the end date to block the range
                    </Text>
                  )}

                  {blockedDates.length > 0 && (
                    <View style={{ marginTop: SPACING.md, gap: 6 }}>
                      {blockedDates.map((range, index) => {
                        const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                        return (
                          <View key={index} style={styles.blockedRow}>
                            <Ionicons name="calendar-outline" size={16} color="#DC2626" />
                            <Text style={styles.blockedTxt}>{fmt(range.start_date)} — {fmt(range.end_date)}</Text>
                            <TouchableOpacity onPress={() => removeRange(index)} style={{ padding: 4 }}>
                              <Ionicons name="close-circle-outline" size={20} color={COLORS.textMut} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {hasUnsavedDates && (
                    <TouchableOpacity
                      style={[styles.saveAvailBtn, savingDates && { opacity: 0.7 }]}
                      onPress={handleSaveBlockedDates}
                      activeOpacity={0.85}
                      disabled={savingDates}
                    >
                      {savingDates ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.saveAvailTxt}>Save availability</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  <View style={styles.snoozeCard}>
                    <View style={styles.snoozeContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons
                          name={listingStatus === 'snoozed' ? 'moon' : 'moon-outline'}
                          size={20}
                          color={listingStatus === 'snoozed' ? '#F59E0B' : COLORS.textSec}
                        />
                        <Text style={styles.snoozeTitle}>Snooze listing</Text>
                      </View>
                      <Text style={styles.snoozeSub}>
                        {listingStatus === 'snoozed'
                          ? 'Your listing is hidden from guests. Toggle off to make it visible again.'
                          : 'Toggle on to temporarily hide this listing from guests.'}
                      </Text>
                    </View>
                    <Switch
                      value={listingStatus === 'snoozed'}
                      onValueChange={handleToggleSnooze}
                      disabled={togglingSnooze}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#fff"
                      ios_backgroundColor={COLORS.border}
                    />
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom bar — host view */}
      {!isPreview && item && (
        <View style={styles.stickyBar}>
          <TouchableOpacity
            style={[styles.deleteBarBtn, deleting && { opacity: 0.7 }]}
            onPress={handleDeleteListing}
            activeOpacity={0.85}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                <Text style={styles.deleteBarTxt}>Delete listing</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bookBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ListingEditor', { listingId: item.listing_id })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={styles.bookBtnTxt}>Edit listing</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {isPreview && (
        <View style={styles.stickyBar}>
          <View>
            <Text style={styles.stickyPrice}>
              ₹{guestPrice.toLocaleString('en-IN')}
              <Text style={styles.stickyPriceUnit}>/night</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.stickyBookBtn} activeOpacity={0.85} onPress={() => navigation.goBack()}>
            <Text style={styles.stickyBookBtnText}>Back to edit</Text>
          </TouchableOpacity>
        </View>
      )}

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
      {/* ── Photo Gallery Modal ── */}
      {showPhotoGallery && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowPhotoGallery(false)}>
          <View style={styles.galleryOverlay}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: activePhotoIdx * SCREEN_W, y: 0 }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setActivePhotoIdx(idx);
              }}
              style={{ flex: 1 }}
            >
              {allPhotos.map((uri, i) => (
                <View key={i} style={{ width: SCREEN_W, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <Image source={{ uri }} style={styles.galleryPhoto} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
            <View style={styles.galleryHeader} pointerEvents="box-none">
              <TouchableOpacity style={styles.galleryCloseBtn} onPress={() => setShowPhotoGallery(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.galleryCounter}>
                {activePhotoIdx + 1} / {allPhotos.length}
              </Text>
              <View style={{ width: 40 }} />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  previewBannerTxt: { fontSize: 12, color: COLORS.primaryDark, ...FONTS.medium, flex: 1 },

  photoWrap: { position: 'relative', width: SCREEN_W, height: 240, backgroundColor: COLORS.warm },
  coverPhoto: { width: SCREEN_W, height: 240 },
  photoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  photoCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCounterTxt: { fontSize: 12, color: '#fff', ...FONTS.medium },
  galleryOverlay: { flex: 1, backgroundColor: '#000' },
  galleryHeader: { position: 'absolute', top: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md },
  galleryCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  galleryCounter: { fontSize: 16, color: '#fff', ...FONTS.semibold },
  galleryPhoto: { width: SCREEN_W, height: SCREEN_W },

  backBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  body: { padding: SPACING.lg },

  title: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: 6, lineHeight: 30 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.sm },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
  },
  badgeText: { fontSize: 12, ...FONTS.medium, color: COLORS.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  locationTxt: { fontSize: 14, color: COLORS.textSec },

  miniMapWrap: {
    borderRadius: RADIUS.md, overflow: 'hidden', height: 180, marginBottom: SPACING.sm,
  },
  miniMap: { width: '100%', height: 180 },
  locationDisclaimer: { fontSize: 12, color: COLORS.textMut, textAlign: 'center' },
  priceRow: { marginBottom: SPACING.md },
  price: { fontSize: 26, ...FONTS.serif, color: COLORS.text },
  priceUnit: { fontSize: 14, ...FONTS.regular, color: COLORS.textSec },
  guestPrice: { fontSize: 13, color: COLORS.textSec, marginTop: 4 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: COLORS.primary },
  sectionHeader: { fontSize: 13, ...FONTS.bold, letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.text },

  description: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },

  spaceList: { gap: 0, marginBottom: SPACING.sm },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  spaceRowIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center' },
  spaceRowLabel: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  spaceRowSub: { fontSize: 12, color: COLORS.textSec, marginTop: 1 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },

  amenitiesGrid: { gap: 4 },
  amenityRow: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingRight: SPACING.sm },
  amenityTxt: { fontSize: 14, color: COLORS.text, ...FONTS.medium, flex: 1 },

  foodChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  foodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha,
  },
  foodChipText: { fontSize: 13, color: COLORS.primary, ...FONTS.medium },
  foodDesc: { fontSize: 13, color: COLORS.textSec, marginTop: SPACING.sm, lineHeight: 20 },

  flatmateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  flatmateAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flatmateInitials: { fontSize: 14, ...FONTS.bold, color: COLORS.primary },
  flatmateName: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  flatmateDetail: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryAlpha,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  hostBadgeTxt: { fontSize: 10, ...FONTS.semibold, color: COLORS.primary },

  checkinRow: { flexDirection: 'row', gap: SPACING.sm },
  checkinCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 6,
  },
  checkinLabel: { fontSize: 12, color: COLORS.textSec },
  checkinTime: { fontSize: 16, ...FONTS.bold, color: COLORS.text },

  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  blockedTxt: { flex: 1, fontSize: 14, color: COLORS.text, ...FONTS.medium },
  saveAvailBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveAvailTxt: { color: '#fff', fontSize: 15, ...FONTS.semibold },
  snoozeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  snoozeContent: { flex: 1, marginRight: 12 },
  snoozeTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.text },
  snoozeSub: { fontSize: 13, color: COLORS.textSec, marginTop: 4, lineHeight: 19 },
  deleteBarBtn: {
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: RADIUS.pill,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  deleteBarTxt: { color: '#DC2626', fontSize: 15, ...FONTS.semibold },


  limitedInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.primaryAlpha,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.md,
  },
  limitedInfoTxt: { fontSize: 12, color: COLORS.primaryDark, flex: 1, lineHeight: 18 },

  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: 32,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  bookBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: RADIUS.pill,
  },
  bookBtnTxt: { color: '#fff', fontSize: 15, ...FONTS.semibold },

  stickyPrice: { fontSize: 22, ...FONTS.bold, color: COLORS.text },
  stickyPriceUnit: { fontSize: 13, ...FONTS.regular, color: COLORS.textSec },
  stickyBookBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 13, paddingHorizontal: 28,
    borderRadius: RADIUS.md,
  },
  stickyBookBtnText: { color: '#fff', fontSize: 15, ...FONTS.semibold },

  stayInfoRow: { flexDirection: 'row', gap: SPACING.md },
  stayInfoItem: { flex: 1, alignItems: 'center' },
  stayInfoLabel: { fontSize: 12, color: COLORS.textSec, marginBottom: 4 },
  stayInfoValue: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },

  apartmentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  apartmentNameTxt: { fontSize: 18, ...FONTS.bold, color: COLORS.text },

  subSectionLabel: { fontSize: 11, ...FONTS.semibold, color: COLORS.textSec, letterSpacing: 1, textTransform: 'uppercase', marginBottom: SPACING.sm, marginTop: SPACING.sm },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    ...SHADOW.sm,
  },
  featureChipTxt: { fontSize: 12, color: COLORS.text, ...FONTS.medium },
  nearbyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nearbyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryAlpha },
  nearbyChipText: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },

  landmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  landmarkTxt: { flex: 1, fontSize: 14, color: COLORS.text },
  landmarkDist: { fontSize: 12, color: COLORS.textSec, ...FONTS.medium },

  foodOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  foodOptionCard: {
    flex: 1,
    minWidth: '40%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 6,
  },
  foodOptionLabel: { fontSize: 13, ...FONTS.medium, color: COLORS.text, textAlign: 'center' },
  mealCostRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  mealCostTxt: { fontSize: 13, color: COLORS.textSec },

  amenityGroup: { marginBottom: SPACING.md },
  amenityGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  amenityGroupLabel: { fontSize: 11, ...FONTS.semibold, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.textSec },
  amenityGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingLeft: SPACING.sm },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: SPACING.sm },
  addressTxt: { flex: 1, fontSize: 13, color: COLORS.textSec, lineHeight: 18 },

  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  ruleRowTxt: { fontSize: 14, color: COLORS.text, ...FONTS.medium },
  customRuleBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.raised,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  customRuleLabel: { fontSize: 12, ...FONTS.semibold, color: COLORS.textSec, marginBottom: 4 },
  customRuleTxt: { fontSize: 13, color: COLORS.text, lineHeight: 20 },

  reviewsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  breakdownWrap: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.md },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { width: 116, fontSize: 13, color: COLORS.textSec },
  breakdownTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  breakdownFill: { height: 5, borderRadius: 3, backgroundColor: '#F59E0B' },
  breakdownVal: { width: 30, fontSize: 13, ...FONTS.semibold, color: COLORS.text, textAlign: 'right' as const },
  reviewCard: { width: 280, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.md },
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
});
