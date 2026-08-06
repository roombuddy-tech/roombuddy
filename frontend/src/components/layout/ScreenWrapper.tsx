import React, { useMemo } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bg?: string;
}

export default function ScreenWrapper({ children, scroll = true, padded = true, bg }: ScreenWrapperProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const content = (
    <View style={[styles.inner, padded && styles.padded]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, bg ? { backgroundColor: bg } : null]}>
      {scroll ? (
        // KeyboardAwareScrollView (not KeyboardAvoidingView + ScrollView) so the
        // focused input — or anything rendered below it, like a places-autocomplete
        // dropdown — actually scrolls above the keyboard on both platforms.
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={20}
          keyboardOpeningTime={0}
        >
          {content}
        </KeyboardAwareScrollView>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {content}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  inner: { flex: 1 },
  padded: { paddingHorizontal: SPACING.lg },
});
