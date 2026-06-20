import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';

interface TermsPrivacyScreenProps {
  visible: boolean;
  onClose: () => void;
}

type ActiveTab = 'terms' | 'privacy';

export default function TermsPrivacyScreen({ visible, onClose }: TermsPrivacyScreenProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('terms');
  const [loading, setLoading] = useState(true);
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const url = activeTab === 'terms'
    ? 'https://roombuddy.co.in/terms/'
    : 'https://roombuddy.co.in/privacy/';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => { setActiveTab('terms'); setLoading(true); }}
        >
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => { setActiveTab('privacy'); setLoading(true); }}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {loading && (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={styles.loader}
          />
        )}
        <WebView
          key={activeTab}
          source={{ uri: url }}
          onLoadEnd={() => setLoading(false)}
          style={{ flex: 1, opacity: loading ? 0 : 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  headerTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.sm },
  tabActive: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  tabText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  tabTextActive: { color: COLORS.primary, ...FONTS.semibold },
  loader: { position: 'absolute', top: '40%', left: 0, right: 0, zIndex: 1 },
});