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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, DateData } from 'react-native-calendars';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { CONFIG } from '../../constants/config';
import type { HostStackParamList } from '../../navigation/types';
import { getListing, updateBlockedDates, deleteListing, toggleSnooze } from '../../services/listings';

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
  'Water purifier': 'filter-outline',
  'Utensils provided': 'cafe-outline',
  'TV': 'tv-outline',
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

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function ListingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { preview, item } = route.params ?? {};

  const isPreview = !!preview;
  const f = preview;

  const [fetchedPhotos, setFetchedPhotos] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<Array<{ start_date: string; end_date: string }>>([]);
  const [savedDates, setSavedDates] = useState<Array<{ start_date: string; end_date: string }>>([]);
  const [selectingStart, setSelectingStart] = useState<string | null>(null);
  const [savingDates, setSavingDates] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [listingStatus, setListingStatus] = useState<string>(item?.status ?? 'live');
  const [togglingSnooze, setTogglingSnooze] = useState(false);

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
      }
    }, [item?.listing_id, isPreview]),
  );

  const today = new Date().toISOString().split('T')[0];

  const onDayPress = (day: DateData) => {
    if (day.dateString < today) return;
    if (!selectingStart) {
      setSelectingStart(day.dateString);
    } else {
      const start = selectingStart <= day.dateString ? selectingStart : day.dateString;
      const end = selectingStart <= day.dateString ? day.dateString : selectingStart;
      setBlockedDates((prev) => [...prev, { start_date: start, end_date: end }]);
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
      marks[selectingStart] = { startingDay: true, endingDay: true, color: COLORS.accent, textColor: '#fff' };
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
  const guestPrice = f
    ? Math.round(hostPrice * (1 + CONFIG.GST_PCT + CONFIG.GUEST_PLATFORM_FEE_PCT))
    : (item?.guest_price_per_night ?? 0);

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
    areaName,
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
              renderItem={({ item: uri }) => (
                <Image
                  source={{ uri }}
                  style={styles.coverPhoto}
                  resizeMode="cover"
                />
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
              {/* Title */}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{previewSubtitle}</Text>

              {/* Badges */}
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.badgeText}>Verified</Text>
                </View>
              </View>

              {/* Description */}
              {f.description ? (
                <>
                  <Divider />
                  <Text style={styles.sectionHeader}>About this room</Text>
                  <Text style={styles.description}>
                    {f.description.replace(/\n{2,}/g, '\n').trim()}
                  </Text>
                </>
              ) : null}

              {/* Flatmates */}
              {(f.flatmates?.length > 0 || f.hostOccupation || f.hostHobbies) && (
                <>
                  <Divider />
                  <Text style={styles.sectionHeader}>{'👥 Meet your flatmates'}</Text>
                  {(f.hostOccupation || f.hostHobbies) && (
                    <View style={styles.flatmateCard}>
                      <View style={styles.flatmateAvatar}>
                        <Text style={styles.flatmateInitials}>H</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.flatmateName}>Host</Text>
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeTxt}>Host</Text>
                          </View>
                        </View>
                        {f.hostOccupation ? <Text style={styles.flatmateDetail}>{f.hostOccupation}</Text> : null}
                        {f.hostHobbies ? <Text style={styles.flatmateDetail}>{f.hostHobbies}</Text> : null}
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
                        {fm.occupation ? <Text style={styles.flatmateDetail}>{fm.occupation}</Text> : null}
                        {fm.hobbies ? <Text style={styles.flatmateDetail}>{fm.hobbies}</Text> : null}
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Food options */}
              {(f.kitchenAccess || f.homeCooked) && (
                <>
                  <Divider />
                  <Text style={styles.sectionHeader}>{'🍳 Food options'}</Text>
                  <View style={styles.foodChipRow}>
                    {f.kitchenAccess && (
                      <View style={styles.foodChip}>
                        <Text style={styles.foodChipText}>Kitchen access</Text>
                      </View>
                    )}
                    {f.homeCooked && f.mealCost && (
                      <View style={styles.foodChip}>
                        <Text style={styles.foodChipText}>Tiffin ₹{f.mealCost}/meal</Text>
                      </View>
                    )}
                    {(f.amenities as string[])?.includes('Utensils provided') && (
                      <View style={styles.foodChip}>
                        <Text style={styles.foodChipText}>Utensils provided</Text>
                      </View>
                    )}
                  </View>
                  {f.mealDescription ? <Text style={styles.foodDesc}>{f.mealDescription}</Text> : null}
                </>
              )}

              {/* Amenities */}
              {f.amenities && f.amenities.length > 0 && (
                <>
                  <Divider />
                  <Text style={styles.sectionHeader}>{'✨ Amenities'}</Text>
                  <View style={styles.amenitiesGrid}>
                    {(f.amenities as string[]).map((a: string) => (
                      <View key={a} style={styles.amenityRow}>
                        <Ionicons
                          name={(AMENITY_ICONS[a] ?? 'checkmark-outline') as any}
                          size={18}
                          color={COLORS.primary}
                        />
                        <Text style={styles.amenityTxt}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* The space */}
              {(f.apartmentType || f.roomType) && (
                <>
                  <Divider />
                  <Text style={styles.sectionHeader}>The space</Text>
                  <View style={styles.spaceGrid}>
                    {f.apartmentType ? (
                      <View style={styles.spaceCard}>
                        <Ionicons name="home-outline" size={22} color={COLORS.primary} />
                        <Text style={styles.spaceCardLabel}>{aptLabel[f.apartmentType] || f.apartmentType}</Text>
                        {f.floorNumber ? <Text style={styles.spaceCardSub}>Floor {f.floorNumber}</Text> : null}
                      </View>
                    ) : null}
                    {f.roomType ? (
                      <View style={styles.spaceCard}>
                        <MaterialCommunityIcons
                          name={f.roomType === 'private' ? 'door-closed-lock' : 'bunk-bed-outline'}
                          size={22}
                          color={COLORS.primary}
                        />
                        <Text style={styles.spaceCardLabel}>
                          {f.roomType === 'private' ? 'Private room' : 'Shared room'}
                        </Text>
                        {f.bedType ? <Text style={styles.spaceCardSub}>{bedLabel(f.bedType)}</Text> : null}
                      </View>
                    ) : null}
                    {f.bathroom ? (
                      <View style={styles.spaceCard}>
                        <Ionicons name="water-outline" size={22} color={COLORS.primary} />
                        <Text style={styles.spaceCardLabel}>{bathroomLabel(f.bathroom)}</Text>
                      </View>
                    ) : null}
                    {f.roomSize ? (
                      <View style={styles.spaceCard}>
                        <Ionicons name="expand-outline" size={22} color={COLORS.primary} />
                        <Text style={styles.spaceCardLabel}>{f.roomSize} sq ft</Text>
                      </View>
                    ) : null}
                  </View>

                  {f.roomFeatures && f.roomFeatures.length > 0 && (
                    <View style={styles.featureRow}>
                      {f.roomFeatures.map((feat: string) => (
                        <View key={feat} style={styles.featureChip}>
                          <Text style={styles.featureChipTxt}>{feat}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Approximate location map */}
              {f.latitude && f.longitude && (
                <>
                  <Divider />
                  <Text style={styles.sectionHeader}>Approximate location</Text>
                  <View style={styles.miniMapWrap}>
                    <MapView
                      style={styles.miniMap}
                      provider={PROVIDER_GOOGLE}
                      initialRegion={{
                        latitude: f.latitude,
                        longitude: f.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                    >
                      <Circle
                        center={{ latitude: f.latitude, longitude: f.longitude }}
                        radius={300}
                        fillColor="rgba(13,115,119,0.12)"
                        strokeColor="rgba(13,115,119,0.3)"
                        strokeWidth={1}
                      />
                    </MapView>
                  </View>
                  <Text style={styles.locationDisclaimer}>Exact location shared after booking</Text>
                </>
              )}

              {/* Check-in / Check-out */}
              {(f.checkInTime || f.checkOutTime) && (
                <>
                  <Divider />
                  <Text style={styles.sectionHeader}>Check-in / Check-out</Text>
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
                  </View>
                </>
              )}

              {/* Stay info */}
              <Divider />
              <View style={styles.stayInfoRow}>
                <View style={styles.stayInfoItem}>
                  <Text style={styles.stayInfoLabel}>Min stay</Text>
                  <Text style={styles.stayInfoValue}>{previewMinNights} night{previewMinNights !== 1 ? 's' : ''}</Text>
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
                {guestPrice > 0 && hostPrice !== guestPrice && (
                  <Text style={styles.guestPrice}>
                    Guest pays: ₹{guestPrice.toLocaleString('en-IN')}/night (incl. taxes & fees)
                  </Text>
                )}
              </View>

              <Divider />

              {/* Availability — interactive calendar */}
              {item && (
                <>
                  <SectionHeader title="Availability" />
                  <Text style={{ fontSize: 13, color: COLORS.textSec, marginBottom: SPACING.sm }}>
                    Tap a date to start, then tap another to block a range
                  </Text>
                  <Calendar
                    minDate={today}
                    markingType="period"
                    markedDates={getMarkedDates()}
                    onDayPress={onDayPress}
                    theme={{
                      todayTextColor: COLORS.primary,
                      arrowColor: COLORS.primary,
                      textDayFontFamily: FONTS.medium.fontWeight,
                      textMonthFontFamily: FONTS.semibold.fontWeight,
                      textDayHeaderFontFamily: FONTS.medium.fontWeight,
                    }}
                    style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border }}
                  />

                  {selectingStart && (
                    <Text style={{ fontSize: 13, color: COLORS.accent, marginTop: SPACING.sm, ...FONTS.medium }}>
                      Tap another date to complete the range
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
                          ? 'Your listing is hidden from guests. Turn off to make it visible again.'
                          : 'Temporarily hide this listing from guests without deleting it.'}
                      </Text>
                    </View>
                    <Switch
                      value={listingStatus === 'snoozed'}
                      onValueChange={handleToggleSnooze}
                      disabled={togglingSnooze}
                      trackColor={{ false: '#E2E8F0', true: '#FDE68A' }}
                      thumbColor={listingStatus === 'snoozed' ? '#F59E0B' : '#fff'}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  previewBannerTxt: { fontSize: 12, color: '#92400E', ...FONTS.medium, flex: 1 },

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

  title: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
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
  priceRow: { marginBottom: SPACING.sm },
  price: { fontSize: 22, ...FONTS.bold, color: COLORS.text },
  priceUnit: { fontSize: 14, ...FONTS.regular, color: COLORS.textSec },
  guestPrice: { fontSize: 12, color: COLORS.textMut, marginTop: 2 },

  sectionHeader: { fontSize: 17, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },

  description: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },

  spaceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  spaceCard: {
    width: '47%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  spaceCardLabel: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  spaceCardSub: { fontSize: 12, color: COLORS.textSec },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  featureChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  featureChipTxt: { fontSize: 12, color: COLORS.textSec },

  amenitiesGrid: { gap: 4 },
  amenityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  amenityTxt: { fontSize: 14, color: COLORS.text },

  foodChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foodChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.md, backgroundColor: COLORS.primaryAlpha,
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
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 4,
  },
  checkinLabel: { fontSize: 12, color: COLORS.textSec },
  checkinTime: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },

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
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveAvailTxt: { color: '#fff', fontSize: 15, ...FONTS.semibold },
  snoozeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  snoozeContent: { flex: 1, marginRight: 12 },
  snoozeTitle: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  snoozeSub: { fontSize: 12, color: COLORS.textSec, marginTop: 4, lineHeight: 18 },
  deleteBarBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
  },
  bookBtnTxt: { color: '#fff', fontSize: 15, ...FONTS.semibold },

  stickyPrice: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  stickyPriceUnit: { fontSize: 13, ...FONTS.regular, color: COLORS.textSec },
  stickyBookBtn: {
    backgroundColor: COLORS.accent, paddingVertical: 13, paddingHorizontal: 28,
    borderRadius: RADIUS.md,
  },
  stickyBookBtnText: { color: '#fff', fontSize: 15, ...FONTS.semibold },

  stayInfoRow: { flexDirection: 'row', gap: SPACING.md },
  stayInfoItem: { flex: 1, alignItems: 'center' },
  stayInfoLabel: { fontSize: 12, color: COLORS.textSec, marginBottom: 4 },
  stayInfoValue: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
});
