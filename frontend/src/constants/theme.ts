// ─────────────────────────────────────────────────────────────────────────
// RoomBuddy design tokens — Terracotta (light) + Luxe Dark
// Both palettes are exported; the active palette is chosen at runtime via
// ThemeContext (see context/ThemeContext.tsx + hooks/useThemedStyles.ts).
// ─────────────────────────────────────────────────────────────────────────

export const COLORS_LIGHT = {
  // Brand
  primary: '#B85C38',
  primaryDark: '#8F4426',
  primaryDeep: '#5E2E1A',
  onPrimary: '#FBF4EC',

  // Secondary accent (sparing — trust, meals, success-ish)
  accent: '#3F5145',
  accentSoft: '#E4EAE2',

  // Grounds
  canvas: '#E7E2D8',
  bg: '#F4F0EA',
  surface: '#FFFFFF',
  raised: '#FBF8F3',

  // Ink / text
  text: '#2A2420',
  textSec: '#6E6458',
  textMut: '#A89C8B',

  // Lines
  border: '#E8DFD2',
  borderSubtle: '#EFE8DC',

  // Support
  chip: '#F1E9DD',
  chipInk: '#7A6A57',
  star: '#C8923C',
  success: '#3F7A52',
  danger: '#C2452F',

  // Overlays
  overlay: 'rgba(36,26,18,0.45)',
  primaryAlpha: 'rgba(184,92,56,0.08)',

  // ── Backward-compat aliases (legacy key names → new palette) ──
  primaryLight: '#B85C38',
  accentHover: '#3F5145',
  warm: '#F4F0EA',
  warmAlt: '#FBF8F3',
  info: '#3F5145',
  accentAlpha: 'rgba(184,92,56,0.08)',
} as const;

export const COLORS_DARK = {
  primary: '#C9A24B',
  primaryDark: '#A9863A',
  primaryDeep: '#7E6126',
  onPrimary: '#15120A',

  accent: '#8FA58C',
  accentSoft: 'rgba(143,165,140,0.14)',

  canvas: '#070809',
  bg: '#0E0F12',
  surface: '#16181C',
  raised: '#1D2026',

  text: '#F3F1EC',
  textSec: '#AEB2BA',
  textMut: '#71757E',

  border: 'rgba(255,255,255,0.09)',
  borderSubtle: 'rgba(255,255,255,0.06)',

  chip: 'rgba(201,162,75,0.13)',
  chipInk: '#D9BE7E',
  star: '#C9A24B',
  success: '#7FB890',
  danger: '#E0795F',

  overlay: 'rgba(0,0,0,0.55)',
  primaryAlpha: 'rgba(201,162,75,0.12)',

  // Legacy aliases
  primaryLight: '#C9A24B',
  accentHover: '#8FA58C',
  warm: '#0E0F12',
  warmAlt: '#1D2026',
  info: '#8FA58C',
  accentAlpha: 'rgba(201,162,75,0.12)',
} as const;

export type ThemeMode = 'light' | 'dark';
export type ThemeColors = { [K in keyof typeof COLORS_DARK]: string };

export const PALETTES: Record<ThemeMode, ThemeColors> = {
  light: COLORS_LIGHT,
  dark: COLORS_DARK,
};

// Legacy default export — used by code that hasn't been migrated to
// useThemeColors() yet. Defaults to the dark palette so it's safe to read
// at module load time. Prefer useThemeColors() in new components.
export const COLORS: ThemeColors = COLORS_DARK;

// ─────────────────────────────────────────────────────────────────────────
// Typography — Newsreader (serif, headlines/prices) + Hanken Grotesk (UI)
// ─────────────────────────────────────────────────────────────────────────

export const FONTS = {
  // Serif — headlines & prices only
  serifLight: { fontFamily: 'Newsreader_300Light' },
  serif: { fontFamily: 'Newsreader_400Regular' },
  serifMedium: { fontFamily: 'Newsreader_500Medium' },
  serifItalic: { fontFamily: 'Newsreader_400Regular_Italic' },

  // Sans — everything else
  regular: { fontFamily: 'HankenGrotesk_400Regular' },
  medium: { fontFamily: 'HankenGrotesk_500Medium' },
  semibold: { fontFamily: 'HankenGrotesk_600SemiBold' },
  bold: { fontFamily: 'HankenGrotesk_700Bold' },

  // Legacy alias — spec drops extrabold; map to bold to keep call sites alive
  extrabold: { fontFamily: 'HankenGrotesk_700Bold' },
} as const;

export const buildTypography = (c: ThemeColors) => ({
  display: {
    ...FONTS.serifLight,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: c.text,
  },
  title: {
    ...FONTS.serif,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: c.text,
  },
  headline: {
    ...FONTS.serif,
    fontSize: 17,
    lineHeight: 24,
    color: c.text,
  },
  price: {
    ...FONTS.serif,
    fontSize: 20,
    lineHeight: 26,
    color: c.text,
  },
  bodyLg: {
    ...FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: c.text,
  },
  body: {
    ...FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: c.text,
  },
  label: {
    ...FONTS.semibold,
    fontSize: 12.5,
    lineHeight: 16,
    color: c.text,
  },
  caption: {
    ...FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: c.textSec,
  },
  eyebrow: {
    ...FONTS.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: c.textSec,
  },
});

export const TYPOGRAPHY = buildTypography(COLORS);

// ─────────────────────────────────────────────────────────────────────────
// Spacing / radius / shadow
// ─────────────────────────────────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 9999,
};

const SHADOWS_DARK = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 26,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.7,
    shadowRadius: 44,
    elevation: 9,
  },
};

const SHADOWS_LIGHT = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
};

export type ThemeShadows = typeof SHADOWS_DARK;

export const SHADOWS: Record<ThemeMode, ThemeShadows> = {
  light: SHADOWS_LIGHT,
  dark: SHADOWS_DARK,
};

// Legacy default — defaults to dark variant. Prefer useTheme().shadows.
export const SHADOW: ThemeShadows = SHADOWS_DARK;
