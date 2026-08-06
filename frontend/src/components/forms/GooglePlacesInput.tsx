import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GooglePlaceData, GooglePlaceDetail, GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../../constants/maps';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';

export interface GooglePlacesInputHandle {
  setAddressText: (text: string) => void;
}

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
  onChangeText?: (text: string) => void;
}

function extractComponent(details: GooglePlaceDetail, type: string): string {
  const comp = details.address_components?.find((c: any) => c.types.includes(type));
  return comp?.long_name ?? '';
}

function GooglePlacesInput(
  { value, placeholder, onSelect, onChangeText }: Props,
  forwardedRef: React.Ref<GooglePlacesInputHandle>
) {
  const ref = useRef<any>(null);
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  useEffect(() => {
    if (ref.current && value) {
      ref.current.setAddressText(value);
    }
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    setAddressText: (text: string) => ref.current?.setAddressText(text),
  }));

  return (
    <View style={styles.wrap}>
      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder ?? 'Search for your locality...'}
        fetchDetails
        onPress={(data: GooglePlaceData, detail: GooglePlaceDetail | null) => {
          if (!detail) {
            // Place Details lookup failed (network hiccup, rate limit, etc.) —
            // still commit the picked suggestion instead of silently dropping
            // it and leaving whatever was manually typed.
            onSelect({
              description: data.description,
              placeId: data.place_id ?? '',
              lat: 0,
              lng: 0,
              city: data.structured_formatting?.main_text || data.description,
              state: '',
              pincode: '',
              addressLine1: data.structured_formatting?.main_text || '',
            });
            return;
          }
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
          onChangeText: onChangeText,
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
        autoFillOnNotFound
        onFail={(error) => console.warn('GooglePlacesInput: details request failed', error)}
        onNotFound={() => console.warn('GooglePlacesInput: place details not found')}
      />
    </View>
  );
}

export default forwardRef(GooglePlacesInput);

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
