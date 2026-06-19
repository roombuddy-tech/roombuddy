import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { COLORS, RADIUS, FONTS } from '../../constants/theme';

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export default function Button({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, full = false, icon, style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [
    styles.base,
    styles[`container_${variant}`],
    styles[`size_${size}`],
    full && styles.full,
    isDisabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    isDisabled && styles.textDisabled,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={containerStyles}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? COLORS.primary : COLORS.onPrimary} size="small" />
      ) : (
        <>
          {icon}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.pill,
  },
  full: { width: '100%' },
  disabled: { opacity: 0.5 },

  // Variants
  container_primary: { backgroundColor: COLORS.primary },
  container_accent: { backgroundColor: COLORS.accent },
  container_outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  container_ghost: { backgroundColor: 'transparent' },
  container_danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.danger },

  // Sizes
  size_sm: { paddingVertical: 10, paddingHorizontal: 18 },
  size_md: { paddingVertical: 14, paddingHorizontal: 24 },
  size_lg: { paddingVertical: 16, paddingHorizontal: 32 },

  // Text
  text: { ...FONTS.semibold, letterSpacing: 0.1 },
  text_primary: { color: COLORS.onPrimary },
  text_accent: { color: COLORS.onPrimary },
  text_outline: { color: COLORS.text },
  text_ghost: { color: COLORS.primary },
  text_danger: { color: COLORS.danger },
  textDisabled: { color: COLORS.textMut },

  textSize_sm: { fontSize: 13 },
  textSize_md: { fontSize: 14.5 },
  textSize_lg: { fontSize: 16 },
});