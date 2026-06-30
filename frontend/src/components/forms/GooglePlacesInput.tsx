import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GooglePlaceData, GooglePlaceDetail, GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../../constants/maps';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';

export interface PlaceResult {
  description: string;
  placeId: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  pincode: string;
  addressLine1: string;
}

interface Props {
  value: string;
  placeholder?: string;
  onSelect: (place: PlaceResult) => void;
}

function extractComponent(details: GooglePlaceDetail, type: string): string {
  const comp = details.address_components?.find((c: any) => c.types.includes(type));
  return comp?.long_name ?? '';
}

export default function GooglePlacesInput({ value, placeholder, onSelect }: Props) {
  const ref = useRef<any>(null);
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  useEffect(() => {
    if (ref.current && value) {
      ref.current.setAddressText(value);
    }
  }, []);

  return (
    <View style={styles.wrap}>
      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder ?? 'Search for your locality...'}
        fetchDetails
        onPress={(data: GooglePlaceData, detail: GooglePlaceDetail | null) => {
          if (!detail) return;
          const loc = detail.geometry?.location;
          const city =
            extractComponent(detail, 'locality') ||
            extractComponent(detail, 'administrative_area_level_2') ||
            extractComponent(detail, 'administrative_area_level_1');
          const state = extractComponent(detail, 'administrative_area_level_1');
          const pincode = extractComponent(detail, 'postal_code');
          const sublocality = extractComponent(detail, 'sublocality_level_1') || extractComponent(detail, 'sublocality');
          const neighborhood = extractComponent(detail, 'neighborhood');
          const addressLine = sublocality || neighborhood || data.structured_formatting?.main_text || '';

          onSelect({
            description: data.description,
            placeId: detail.place_id ?? '',
            lat: loc?.lat ?? 0,
            lng: loc?.lng ?? 0,
            city,
            state,
            pincode,
            addressLine1: addressLine,
          });
        }}
        query={{
          key: GOOGLE_PLACES_API_KEY,
          language: 'en',
          components: 'country:in',
        }}
        textInputProps={{
          placeholderTextColor: COLORS.textMut,
        }}
        styles={{
          textInputContainer: styles.inputContainer,
          textInput: styles.input,
          listView: styles.listView,
          row: styles.row,
          description: styles.rowText,
          poweredContainer: { display: 'none' },
          separator: styles.separator,
        }}
        enablePoweredByContainer={false}
        disableScroll
        debounce={300}
        minLength={2}
        nearbyPlacesAPI="GooglePlacesSearch"
      />
    </View>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  wrap: {
    zIndex: 10,
    marginBottom: SPACING.md,
  },
  inputContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
  },
  input: {
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    ...FONTS.medium,
  },
  listView: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  row: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
  },
  rowText: {
    fontSize: 14,
    color: COLORS.text,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
});
