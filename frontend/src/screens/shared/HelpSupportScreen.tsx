import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

interface HelpSupportScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function HelpSupportScreen({ visible, onClose }: HelpSupportScreenProps) {
  const handleEmail = () => {
    Linking.openURL('mailto:support@roombuddy.co.in?subject=Help%20Request');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/918601257738?text=Hi%2C%20I%20need%20help%20with%20RoomBuddy');
  };

  const handleCall = () => {
    Linking.openURL('tel:+918601257738');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact options */}
        <Text style={styles.sectionTitle}>Get in touch</Text>

        <TouchableOpacity style={styles.contactCard} onPress={handleEmail}>
          <View style={[styles.contactIcon, { backgroundColor: COLORS.primaryAlpha }]}>
            <Ionicons name="mail-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.contactContent}>
            <Text style={styles.contactLabel}>Email us</Text>
            <Text style={styles.contactValue}>support@roombuddy.co.in</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard} onPress={handleWhatsApp}>
          <View style={[styles.contactIcon, { backgroundColor: '#E6F9F0' }]}>
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          </View>
          <View style={styles.contactContent}>
            <Text style={styles.contactLabel}>WhatsApp</Text>
            <Text style={styles.contactValue}>Chat with us</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
          <View style={[styles.contactIcon, { backgroundColor: '#EEF0FF' }]}>
            <Ionicons name="call-outline" size={22} color="#5B5FC7" />
          </View>
          <View style={styles.contactContent}>
            <Text style={styles.contactLabel}>Call us</Text>
            <Text style={styles.contactValue}>+91 8601257738</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
        </TouchableOpacity>

        {/* FAQ section */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>Frequently asked</Text>

        <View style={styles.faqCard}>
          <Text style={styles.faqQ}>How does RoomBuddy work?</Text>
          <Text style={styles.faqA}>Hosts list their spare rooms in shared apartments. Guests book rooms for short stays (days to weeks) with kitchen and common area access.</Text>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.faqQ}>Is my identity verified?</Text>
          <Text style={styles.faqA}>Yes. All users verify their phone number. Email and Aadhaar verification add extra trust and unlock more features.</Text>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.faqQ}>How are payments handled?</Text>
          <Text style={styles.faqA}>Payments will be processed securely through Razorpay. Hosts receive payouts directly to their bank account.</Text>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.faqQ}>What if I have a problem with my stay?</Text>
          <Text style={styles.faqA}>Contact us via email or WhatsApp and we'll help resolve the issue within 24 hours.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  headerTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  content: { flex: 1, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.md },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  contactIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  contactContent: { flex: 1 },
  contactLabel: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  contactValue: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  faqCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  faqQ: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 6 },
  faqA: { fontSize: 13, color: COLORS.textSec, lineHeight: 20 },
});
