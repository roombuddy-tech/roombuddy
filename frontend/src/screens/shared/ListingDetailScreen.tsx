import React, { useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import type { HostStackParamList } from '../../navigation/types';
import { getListing } from '../../services/listings';

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
  return <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.lg }} />;
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function RuleChip({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <View style={styles.ruleChip}>
      <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
      <Text style={styles.ruleChipTxt}>{label}</Text>
    </View>
  );
}

export default function ListingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { preview, item } = route.params ?? {};

  const isPreview = !!preview;
  const f = preview;

  const [fetchedPhotos, setFetchedPhotos] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!isPreview && item?.listing_id) {
        getListing(item.listing_id)
          .then((data: any) => {
            const all = Object.values(data.photos as Record<string, string[]>).flat();
            setFetchedPhotos(all);
          })
          .catch(() => {});
      }
    }, [item?.listing_id, isPreview]),
  );

  // Derive display data from preview form or from list item
  const title = f?.title || item?.title || 'Listing';
  const areaName = f ? `${f.locality}${f.city ? `, ${f.city}` : ''}` : (item?.area_name ?? '');
  const hostPrice = f ? (parseInt(f.nightlyRate, 10) || 0) : (item?.host_price_per_night ?? 0);
  const guestPrice = f
    ? Math.round(hostPrice * 1.18 * 1.08)
    : (item?.guest_price_per_night ?? 0);

  const allPhotos: string[] = f
    ? Object.values(f.photos as Record<string, string[]>).flat().filter(Boolean)
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
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          {isPreview && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeTxt}>✨ New listing</Text>
            </View>
          )}

          {allPhotos.length > 1 && (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterTxt}>
                {activePhotoIdx + 1} / {allPhotos.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {/* Tags */}
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagTxt}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Title + location */}
          <Text style={styles.title}>{title}</Text>
          {areaName ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSec} />
              <Text style={styles.locationTxt}>{areaName}</Text>
            </View>
          ) : null}

          {/* Price */}
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

          {/* About */}
          {f?.description ? (
            <>
              <SectionHeader title="About this room" />
              <Text style={styles.description}>{f.description}</Text>
              <Divider />
            </>
          ) : null}

          {/* The space */}
          {f && (f.apartmentType || f.roomType) && (
            <>
              <SectionHeader title="The space" />
              <View style={styles.spaceGrid}>
                {f.apartmentType ? (
                  <View style={styles.spaceCard}>
                    <Ionicons name="home-outline" size={22} color={COLORS.primary} />
                    <Text style={styles.spaceCardLabel}>{aptLabel[f.apartmentType] || f.apartmentType}</Text>
                    {f.floorNumber ? (
                      <Text style={styles.spaceCardSub}>Floor {f.floorNumber}</Text>
                    ) : null}
                  </View>
                ) : null}
                {f.roomType ? (
                  <View style={styles.spaceCard}>
                    <Ionicons name="bed-outline" size={22} color={COLORS.primary} />
                    <Text style={styles.spaceCardLabel}>
                      {f.roomType === 'private' ? 'Private room' : 'Shared room'}
                    </Text>
                    {f.bedType ? (
                      <Text style={styles.spaceCardSub}>{bedLabel(f.bedType)}</Text>
                    ) : null}
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
                    <Text style={styles.spaceCardLabel}>{f.roomSize}</Text>
                    <Text style={styles.spaceCardSub}>Room size</Text>
                  </View>
                ) : null}
              </View>
              {f.roomFeatures && f.roomFeatures.length > 0 && (
                <>
                  <Text style={styles.subLabel}>Room includes</Text>
                  <View style={styles.featureRow}>
                    {f.roomFeatures.map((feat: string) => (
                      <View key={feat} style={styles.featureChip}>
                        <Text style={styles.featureChipTxt}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              <Divider />
            </>
          )}

          {/* Amenities */}
          {f?.amenities && f.amenities.length > 0 && (
            <>
              <SectionHeader title="What's included" />
              <View style={styles.amenitiesGrid}>
                {(f.amenities as string[]).map((a: string) => (
                  <View key={a} style={styles.amenityRow}>
                    <Ionicons
                      name={AMENITY_ICONS[a] ?? 'checkmark-outline'}
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.amenityTxt}>{a}</Text>
                  </View>
                ))}
              </View>
              <Divider />
            </>
          )}

          {/* Food */}
          {f && (f.kitchenAccess || f.homeCooked) && (
            <>
              <SectionHeader title="Food & kitchen" />
              {f.kitchenAccess && (
                <View style={styles.foodRow}>
                  <Ionicons name="restaurant-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.foodTxt}>Guests can use the kitchen</Text>
                </View>
              )}
              {f.homeCooked && (
                <View style={styles.foodRow}>
                  <Ionicons name="flame-outline" size={18} color={COLORS.primary} />
                  <View>
                    <Text style={styles.foodTxt}>Home-cooked meals available</Text>
                    {f.mealTypes && f.mealTypes.length > 0 && (
                      <Text style={styles.foodSub}>{(f.mealTypes as string[]).join(', ')}</Text>
                    )}
                    {f.mealCost ? (
                      <Text style={styles.foodSub}>₹{f.mealCost}/day extra</Text>
                    ) : null}
                    {f.mealDescription ? (
                      <Text style={styles.foodSub}>{f.mealDescription}</Text>
                    ) : null}
                  </View>
                </View>
              )}
              <Divider />
            </>
          )}

          {/* Flatmates */}
          {f && (f.flatmates?.length > 0 || f.hostOccupation) && (
            <>
              <SectionHeader title="Your flatmates" />
              {/* Host card always first if they added their info */}
              {f.hostOccupation || f.hostHobbies ? (
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
                    {f.hostGender ? (
                      <Text style={styles.flatmateDetail}>
                        {f.hostGender.charAt(0).toUpperCase() + f.hostGender.slice(1)}
                      </Text>
                    ) : null}
                    {f.hostOccupation ? (
                      <Text style={styles.flatmateDetail}>{f.hostOccupation}</Text>
                    ) : null}
                    {f.hostHobbies ? (
                      <Text style={styles.flatmateDetail}>{f.hostHobbies}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {(f.flatmates as any[]).map((fm: any) => (
                <View key={fm.id} style={styles.flatmateCard}>
                  <View style={styles.flatmateAvatar}>
                    <Text style={styles.flatmateInitials}>{initials(fm.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flatmateName}>
                      {fm.name}{fm.age ? `, ${fm.age}` : ''}
                    </Text>
                    {fm.gender ? (
                      <Text style={styles.flatmateDetail}>
                        {fm.gender.charAt(0).toUpperCase() + fm.gender.slice(1)}
                      </Text>
                    ) : null}
                    {fm.occupation || fm.hobbies ? (
                      <Text style={styles.flatmateDetail} numberOfLines={1}>
                        {[fm.occupation, fm.hobbies].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
              <Text style={styles.genderPref}>
                Guest preference:{' '}
                {f.guestGenderPref === 'male_only'
                  ? 'Male only'
                  : f.guestGenderPref === 'female_only'
                  ? 'Female only'
                  : 'Any gender'}
              </Text>
              <Divider />
            </>
          )}

          {/* House rules */}
          {f && (
            <>
              <SectionHeader title="House rules" />
              <View style={styles.rulesGrid}>
                <RuleChip label="No smoking" active={f.noSmoking} />
                <RuleChip label="No loud music after 10 PM" active={f.noLoudMusic} />
                <RuleChip label="No pets" active={f.noPets} />
                <RuleChip label="No parties" active={f.noParties} />
                <RuleChip label="Shoes off indoors" active={f.shoesOff} />
                <RuleChip label="Keep kitchen clean" active={f.kitchenClean} />
                <RuleChip label="No alcohol in common areas" active={f.noAlcohol} />
                <RuleChip label="Lock door when leaving" active={f.lockDoor} />
              </View>
              {f.customRules ? (
                <View style={styles.customRulesBox}>
                  <Text style={styles.customRulesTxt}>{f.customRules}</Text>
                </View>
              ) : null}
              <Divider />
            </>
          )}

          {/* Check-in / Check-out */}
          {f && (f.checkInTime || f.checkOutTime) && (
            <>
              <SectionHeader title="Check-in / Check-out" />
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
              <Divider />
            </>
          )}

          {/* Limited info from list API */}
          {!isPreview && item && (
            <View style={styles.limitedInfoBox}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.limitedInfoTxt}>
                Full listing details require a dedicated API endpoint — coming soon.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom bar — host view */}
      {!isPreview && item && (
        <View style={styles.stickyBar}>
          <View>
            {hostPrice > 0 && (
              <Text style={styles.stickyPrice}>
                ₹{hostPrice.toLocaleString('en-IN')}
                <Text style={styles.stickyPriceUnit}>/night</Text>
              </Text>
            )}
            <Text style={styles.stickyPriceSub}>Your earnings per night</Text>
          </View>
          <View style={styles.stickyActions}>
            <TouchableOpacity
              style={styles.pauseBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('PauseListing', { listingId: item.listing_id })}
            >
              <Ionicons name="pause-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.pauseBtnTxt}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bookBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ListingEditor', { listingId: item.listing_id })}
            >
              <Text style={styles.bookBtnTxt}>Edit listing</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isPreview && (
        <View style={styles.stickyBar}>
          <Text style={styles.previewNote}>Preview mode — not yet live</Text>
          <TouchableOpacity style={styles.closePreviewBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.closePreviewTxt}>Back to edit</Text>
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
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,107,74,0.15)',
  },
  newBadgeTxt: { fontSize: 11, ...FONTS.semibold, color: COLORS.accent },

  body: { padding: SPACING.lg },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagTxt: { fontSize: 11, ...FONTS.medium, color: COLORS.textSec },

  title: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  locationTxt: { fontSize: 14, color: COLORS.textSec },

  priceRow: { marginBottom: SPACING.sm },
  price: { fontSize: 22, ...FONTS.bold, color: COLORS.text },
  priceUnit: { fontSize: 14, ...FONTS.regular, color: COLORS.textSec },
  guestPrice: { fontSize: 12, color: COLORS.textMut, marginTop: 2 },

  sectionHeader: { fontSize: 17, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },

  description: { fontSize: 14, color: COLORS.textSec, lineHeight: 22 },

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
  subLabel: { fontSize: 13, ...FONTS.semibold, color: COLORS.textSec, marginBottom: 8 },
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

  foodRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: SPACING.sm },
  foodTxt: { fontSize: 14, color: COLORS.text, ...FONTS.medium },
  foodSub: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },

  flatmateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  flatmateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  genderPref: { fontSize: 13, color: COLORS.textSec, marginTop: SPACING.sm },

  rulesGrid: { gap: 8, marginBottom: SPACING.sm },
  ruleChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleChipTxt: { fontSize: 14, color: COLORS.text },
  customRulesBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  customRulesTxt: { fontSize: 13, color: COLORS.textSec, lineHeight: 20 },

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
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  stickyPrice: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  stickyPriceUnit: { fontSize: 13, ...FONTS.regular, color: COLORS.textSec },
  stickyPriceSub: { fontSize: 11, color: COLORS.textSec, marginTop: 2 },
  stickyActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.bg,
  },
  pauseBtnTxt: { color: COLORS.primary, fontSize: 14, ...FONTS.semibold },
  bookBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: RADIUS.md,
  },
  bookBtnTxt: { color: '#fff', fontSize: 15, ...FONTS.semibold },
  previewNote: { fontSize: 13, color: COLORS.textSec, ...FONTS.medium },
  closePreviewBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
  },
  closePreviewTxt: { color: '#fff', fontSize: 14, ...FONTS.semibold },
});
