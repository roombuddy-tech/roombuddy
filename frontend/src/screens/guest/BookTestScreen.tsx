import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import type { GuestStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

export default function BookTestScreen() {
  const navigation = useNavigation<Nav>();

  const [listingId, setListingId] = useState('');
  const [listingTitle, setListingTitle] = useState('Test Listing');
  const [checkIn, setCheckIn] = useState(getDateInDays(7));
  const [checkOut, setCheckOut] = useState(getDateInDays(10));
  const [guests, setGuests] = useState('1');

  function go() {
    if (!listingId.trim()) {
      alert('Please paste a listing ID');
      return;
    }
    navigation.navigate('BookingConfirm', {
      listingId: listingId.trim(),
      listingTitle,
      checkIn,
      checkOut,
      numberOfGuests: parseInt(guests, 10) || 1,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.banner}>
        <Ionicons name="construct-outline" size={20} color={COLORS.accent} />
        <Text style={styles.bannerText}>Dev test screen</Text>
      </View>
      <Text style={styles.title}>Test booking flow</Text>
      <Text style={styles.subtitle}>Paste a LIVE listing ID from your seed data and pick dates.</Text>

      <Text style={styles.label}>Listing ID</Text>
      <TextInput style={styles.input} value={listingId} onChangeText={setListingId}
        placeholder="paste UUID from seed_test_data output" autoCapitalize="none" />

      <Text style={styles.label}>Listing title (display only)</Text>
      <TextInput style={styles.input} value={listingTitle} onChangeText={setListingTitle} />

      <Text style={styles.label}>Check-in (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={checkIn} onChangeText={setCheckIn} autoCapitalize="none" />

      <Text style={styles.label}>Check-out (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={checkOut} onChangeText={setCheckOut} autoCapitalize="none" />

      <Text style={styles.label}>Number of guests</Text>
      <TextInput style={styles.input} value={guests} onChangeText={setGuests} keyboardType="number-pad" />

      <TouchableOpacity style={styles.btn} onPress={go}>
        <Text style={styles.btnText}>Start booking flow</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function getDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, paddingTop: 80, backgroundColor: COLORS.bg, minHeight: '100%' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.accentAlpha, padding: SPACING.sm,
    borderRadius: RADIUS.sm, marginBottom: SPACING.lg, alignSelf: 'flex-start',
  },
  bannerText: { color: COLORS.accent, ...FONTS.semibold, fontSize: 12 },
  title: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.lg },
  label: { fontSize: 13, color: COLORS.textSec, marginTop: SPACING.md, marginBottom: 6, ...FONTS.medium },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg,
  },
  btn: {
    marginTop: SPACING.xl, backgroundColor: COLORS.primary,
    paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, ...FONTS.bold },
});