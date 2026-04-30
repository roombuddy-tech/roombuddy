import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

interface TermsPrivacyScreenProps {
  visible: boolean;
  onClose: () => void;
}

type ActiveTab = 'terms' | 'privacy';

export default function TermsPrivacyScreen({ visible, onClose }: TermsPrivacyScreenProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('terms');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & privacy</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab selector */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'terms' && styles.tabActive]} onPress={() => setActiveTab('terms')}>
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'privacy' && styles.tabActive]} onPress={() => setActiveTab('privacy')}>
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'terms' ? (
          <>
            <Text style={styles.lastUpdated}>Last updated: April 2026</Text>

            <Text style={styles.sectionHeader}>1. Acceptance of terms</Text>
            <Text style={styles.body}>By accessing or using the RoomBuddy platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</Text>

            <Text style={styles.sectionHeader}>2. About RoomBuddy</Text>
            <Text style={styles.body}>RoomBuddy is a peer-to-peer platform that connects guests seeking short-term room stays with hosts offering spare rooms in shared apartments across Indian cities.</Text>

            <Text style={styles.sectionHeader}>3. User accounts</Text>
            <Text style={styles.body}>You must provide accurate information during registration. You are responsible for maintaining the security of your account. You must be at least 18 years old to use RoomBuddy.</Text>

            <Text style={styles.sectionHeader}>4. Host responsibilities</Text>
            <Text style={styles.body}>Hosts are responsible for the accuracy of their listings, maintaining a safe and clean living environment, and complying with local laws and regulations regarding short-term rentals.</Text>

            <Text style={styles.sectionHeader}>5. Guest responsibilities</Text>
            <Text style={styles.body}>Guests must respect the host's property, follow house rules, and report any issues promptly. Guests are liable for any damage caused during their stay.</Text>

            <Text style={styles.sectionHeader}>6. Payments and fees</Text>
            <Text style={styles.body}>RoomBuddy charges a service fee of 8-10% from guests and 3-5% from hosts on each booking. All payments are processed securely through our payment partners.</Text>

            <Text style={styles.sectionHeader}>7. Cancellations</Text>
            <Text style={styles.body}>Cancellation policies are set by hosts and displayed on each listing. RoomBuddy may charge a cancellation fee depending on the timing and circumstances.</Text>

            <Text style={styles.sectionHeader}>8. Limitation of liability</Text>
            <Text style={styles.body}>RoomBuddy acts as a platform connecting hosts and guests. We are not responsible for the condition of properties, actions of users, or disputes between hosts and guests.</Text>

            <Text style={styles.sectionHeader}>9. Contact</Text>
            <Text style={styles.body}>For questions about these terms, email us at support@roombuddy.co.in.</Text>
          </>
        ) : (
          <>
            <Text style={styles.lastUpdated}>Last updated: April 2026</Text>

            <Text style={styles.sectionHeader}>1. Information we collect</Text>
            <Text style={styles.body}>We collect information you provide during registration (phone number, name, email, city, gender, date of birth) and usage data (device info, IP address, app interactions).</Text>

            <Text style={styles.sectionHeader}>2. How we use your information</Text>
            <Text style={styles.body}>We use your information to provide and improve our services, verify your identity, process bookings, send transactional communications, and ensure platform safety.</Text>

            <Text style={styles.sectionHeader}>3. Information sharing</Text>
            <Text style={styles.body}>We share limited information with hosts/guests for bookings (name, profile photo). We do not sell your personal data. We may share data with service providers (payment processors, SMS providers) who assist in operating our platform.</Text>

            <Text style={styles.sectionHeader}>4. Data security</Text>
            <Text style={styles.body}>We implement industry-standard security measures including encrypted data transmission, hashed passwords and tokens, and secure server infrastructure on AWS.</Text>

            <Text style={styles.sectionHeader}>5. Your rights</Text>
            <Text style={styles.body}>You can access, update, or delete your personal information through the app settings. You can request complete account deletion by contacting support.</Text>

            <Text style={styles.sectionHeader}>6. Cookies and tracking</Text>
            <Text style={styles.body}>Our mobile app does not use cookies. We collect anonymous analytics to improve app performance and user experience.</Text>

            <Text style={styles.sectionHeader}>7. Data retention</Text>
            <Text style={styles.body}>We retain your data as long as your account is active. After account deletion, we may retain certain data for legal compliance for up to 180 days.</Text>

            <Text style={styles.sectionHeader}>8. Changes to this policy</Text>
            <Text style={styles.body}>We may update this privacy policy from time to time. We will notify you of significant changes via email or in-app notification.</Text>

            <Text style={styles.sectionHeader}>9. Contact</Text>
            <Text style={styles.body}>For privacy-related queries, email us at support@roombuddy.co.in.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  headerTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.lg },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.sm },
  tabActive: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  tabText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  tabTextActive: { color: COLORS.primary, ...FONTS.semibold },
  scrollContent: { paddingBottom: SPACING.xxl },
  lastUpdated: { fontSize: 13, color: COLORS.textMut, marginBottom: SPACING.lg },
  sectionHeader: { fontSize: 15, ...FONTS.bold, color: COLORS.text, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  body: { fontSize: 14, color: COLORS.textSec, lineHeight: 22 },
});
