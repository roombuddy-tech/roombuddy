export const COLORS = {
  // Primary - Teal
  primary: '#0D7377',
  primaryLight: '#14919B',
  primaryDark: '#0A5C5F',
  primaryDeep: '#072829',

  // Accent - Coral
  accent: '#FF6B4A',
  accentHover: '#E85A3A',

  // Warm backgrounds
  warm: '#FFF8F0',
  warmAlt: '#FFF1E6',

  // Neutrals
  bg: '#FFFFFF',
  surface: '#F7F9FA',
  border: '#E8ECEF',

  // Text
  text: '#1A2B3C',
  textSec: '#5F7285',
  textMut: '#94A3B8',

  // Status
  success: '#10B981',
  danger: '#EF4444',
  star: '#FFB800',
  info: '#3B82F6',

  // Transparent
  overlay: 'rgba(0,0,0,0.5)',
  primaryAlpha: 'rgba(13,115,119,0.08)',
  accentAlpha: 'rgba(255,107,74,0.08)',
};

export const FONTS = {
  regular: { fontWeight: '400' as const },
  medium: { fontWeight: '500' as const },
  semibold: { fontWeight: '600' as const },
  bold: { fontWeight: '700' as const },
  extrabold: { fontWeight: '800' as const },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};