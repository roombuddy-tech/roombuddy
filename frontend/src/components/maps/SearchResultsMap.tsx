import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADIUS, SHADOW, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';
import { DEFAULT_REGION } from '../../constants/maps';
import { cardPrice, type GuestListingCard } from '../../types/listing';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  listings: GuestListingCard[];
  onListingPress: (listingId: string) => void;
}

export default function SearchResultsMap({ listings, onListingPress }: Props) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mappable = useMemo(
    () => listings.filter((l) => l.latitude != null && l.longitude != null),
    [listings],
  );

  const region = useMemo(() => {
    if (mappable.length === 0) return DEFAULT_REGION;
    const lats = mappable.map((l) => l.latitude!);
    const lngs = mappable.map((l) => l.longitude!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
    };
  }, [mappable]);

  const selected = mappable.find((l) => l.listing_id === selectedId) ?? null;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onPress={() => setSelectedId(null)}
      >
        {mappable.map((listing) => (
          <Marker
            key={listing.listing_id}
            coordinate={{ latitude: listing.latitude!, longitude: listing.longitude! }}
            onPress={() => setSelectedId(listing.listing_id)}
            tracksViewChanges={false}
          >
            <View style={[styles.priceBubble, selectedId === listing.listing_id && styles.priceBubbleActive]}>
              <Text style={[styles.priceBubbleText, selectedId === listing.listing_id && styles.priceBubbleTextActive]}>
                {cardPrice(listing).amount}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {mappable.length === 0 && (
        <View style={styles.noMapOverlay}>
          <Ionicons name="location-outline" size={32} color={COLORS.textMut} />
          <Text style={styles.noMapText}>No listings with location data</Text>
        </View>
      )}

      {selected && (
        <TouchableOpacity
          style={styles.previewCard}
          activeOpacity={0.9}
          onPress={() => onListingPress(selected.listing_id)}
        >
          <Image
            source={
              selected.cover_photo_url
                ? { uri: selected.cover_photo_url }
                : require('../../../assets/icon.png')
            }
            style={styles.previewImg}
            resizeMode="cover"
          />
          <View style={styles.previewContent}>
            <Text style={styles.previewTitle} numberOfLines={1}>{selected.title}</Text>
            <Text style={styles.previewArea} numberOfLines={1}>{selected.area_name}</Text>
            <Text style={styles.previewPrice}>
              {cardPrice(selected).amount}
              <Text style={styles.previewPriceUnit}>{cardPrice(selected).unit}</Text>
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMut} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { flex: 1 },

  priceBubble: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  priceBubbleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  priceBubbleText: {
    fontSize: 12,
    ...FONTS.bold,
    color: COLORS.text,
  },
  priceBubbleTextActive: {
    color: '#fff',
  },

  noMapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  noMapText: {
    fontSize: 14,
    color: COLORS.textMut,
    marginTop: SPACING.sm,
  },

  previewCard: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOW.md,
  },
  previewImg: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.warm,
  },
  previewContent: { flex: 1 },
  previewTitle: { fontSize: 14, ...FONTS.semibold, color: COLORS.text },
  previewArea: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  previewPrice: { fontSize: 15, ...FONTS.bold, color: COLORS.text, marginTop: 4 },
  previewPriceUnit: { fontSize: 11, ...FONTS.regular, color: COLORS.textSec },
});
