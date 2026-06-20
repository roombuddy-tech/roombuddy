import { useMemo } from 'react';
import { ThemeColors } from '../constants/theme';
import { useThemeColors } from '../context/ThemeContext';

// Builds a memoized StyleSheet (or any style object) keyed on the active
// palette. Call inside a component: `const styles = useThemedStyles(makeStyles)`.
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useThemeColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
