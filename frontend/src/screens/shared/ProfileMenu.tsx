import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/endpoints';
import EditProfileScreen from './EditProfileScreen';
import VerificationScreen from './VerificationScreen';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import PaymentMethodsScreen from './PaymentMethodsScreen';
import HelpSupportScreen from './HelpSupportScreen';
import TermsPrivacyScreen from './TermsPrivacyScreen';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface ProfileData {
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  initials: string;
  city: string;
  gender: string;
  phone_verified: boolean;
  email_verified: boolean;
  aadhaar_verified: boolean;
  member_since: string;
}

type SubScreen = 'none' | 'edit_profile' | 'verification' | 'payment' | 'help' | 'terms';

export default function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeScreen, setActiveScreen] = useState<SubScreen>('none');

  useEffect(() => {
    if (visible) {
      fetchProfile();
      setActiveScreen('none');
    }
  }, [visible]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.USER.PROFILE);
      setProfile(res.data);
    } catch (err) {
      console.log('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  const handleSubScreenClose = () => {
    setActiveScreen('none');
    fetchProfile();
  };

  const renderContent = () => {
    if (activeScreen === 'edit_profile') {
      return <EditProfileScreen visible={true} onClose={handleSubScreenClose} />;
    }

    if (activeScreen === 'verification') {
      return <VerificationScreen visible={true} onClose={handleSubScreenClose} />;
    }

    if (activeScreen === 'payment') {
      return <PaymentMethodsScreen visible={true} onClose={handleSubScreenClose} />;
    }

    if (activeScreen === 'help') {
      return <HelpSupportScreen visible={true} onClose={handleSubScreenClose} />;
    }

    if (activeScreen === 'terms') {
      return <TermsPrivacyScreen visible={true} onClose={handleSubScreenClose} />;
    }


    return (
      <SafeAreaView style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.profileHeader}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitials}>{profile?.initials || 'U'}</Text>
                </View>
                <TouchableOpacity style={styles.editBadge}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.userName}>{profile?.display_name || 'User'}</Text>
              <Text style={styles.userMeta}>
                {profile?.city ? `${profile.city} · ` : ''}Member since {profile?.member_since || ''}
              </Text>

              <View style={styles.badgeRow}>
                {profile?.phone_verified && (
                  <View style={[styles.badge, styles.badgeGreen]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={[styles.badgeText, { color: '#10B981' }]}>Phone verified</Text>
                  </View>
                )}
                {profile?.email_verified ? (
                  <View style={[styles.badge, styles.badgeGreen]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={[styles.badgeText, { color: '#10B981' }]}>Email verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.badge, styles.badgeWarning]} onPress={() => setActiveScreen('verification')}>
                    <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
                    <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Verify email</Text>
                  </TouchableOpacity>
                )}
                {!profile?.aadhaar_verified && (
                  <View style={[styles.badge, styles.badgeOutline]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.textMut} />
                    <Text style={[styles.badgeText, { color: COLORS.textMut }]}>Aadhaar pending</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.menuSection}>
              <TouchableOpacity style={styles.menuItem} onPress={() => setActiveScreen('edit_profile')}>
                <View style={styles.menuLeft}>
                  <Ionicons name="person-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.menuLabel}>Edit profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setActiveScreen('verification')}>
                <View style={styles.menuLeft}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#F59E0B" />
                  <Text style={styles.menuLabel}>Verification</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setActiveScreen('payment')}>
                <View style={styles.menuLeft}>
                  <Ionicons name="card-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.menuLabel}>Payment methods</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setActiveScreen('help')}>
                <View style={styles.menuLeft}>
                  <Ionicons name="help-circle-outline" size={22} color={COLORS.accent} />
                  <Text style={styles.menuLabel}>Help & support</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setActiveScreen('terms')}>
                <View style={styles.menuLeft}>
                  <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.menuLabel}>Terms & privacy</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      {renderContent()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  closeBtn: { alignSelf: 'flex-end', padding: SPACING.sm, marginTop: SPACING.sm },
  profileHeader: { alignItems: 'center', marginBottom: SPACING.xl },
  avatarWrapper: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.border },
  avatarInitials: { fontSize: 28, ...FONTS.bold, color: COLORS.primary },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.bg },
  userName: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  userMeta: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.md },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.pill },
  badgeGreen: { backgroundColor: '#E6F9F0' },
  badgeWarning: { backgroundColor: '#FFF8E6' },
  badgeOutline: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  badgeText: { fontSize: 12, ...FONTS.semibold },
  menuSection: { marginBottom: SPACING.lg },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuLabel: { fontSize: 16, color: COLORS.text, ...FONTS.medium },
  logoutBtn: { alignItems: 'center', paddingVertical: SPACING.md, backgroundColor: '#FFF0F0', borderRadius: RADIUS.md, marginTop: SPACING.sm },
  logoutText: { fontSize: 16, color: COLORS.danger, ...FONTS.semibold },
});