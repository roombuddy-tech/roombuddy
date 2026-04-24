import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, FONTS, SPACING } from '../../constants/theme';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export default function PhoneInput({ value, onChangeText, error, autoFocus }: PhoneInputProps) {
  return (
    <View>
      <Text style={styles.label}>Phone number</Text>
      <View style={[styles.container, error ? styles.containerError : null]}>
        <View style={styles.prefix}>
          <Text style={styles.flag}>🇮🇳</Text>
          <Text style={styles.code}>+91</Text>
        </View>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, '').slice(0, 10))}
          placeholder="Enter phone number"
          placeholderTextColor={COLORS.textMut}
          keyboardType="phone-pad"
          maxLength={10}
          autoFocus={autoFocus}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    color: COLORS.textSec,
    ...FONTS.medium,
    marginBottom: SPACING.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  containerError: {
    borderColor: COLORS.danger,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  flag: { fontSize: 18 },
  code: {
    fontSize: 15,
    color: COLORS.text,
    ...FONTS.semibold,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  input: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    ...FONTS.medium,
    letterSpacing: 1,
  },
  error: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: SPACING.xs,
    ...FONTS.medium,
  },
});