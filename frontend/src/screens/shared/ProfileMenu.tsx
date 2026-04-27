import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

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
  aadhaar_verified: boolean;
  member_since: string;
}

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Edit profile', color: COLORS.primary },
  { icon: 'shield-checkmark-outline', label: 'Verification', color: '#F59E0B' },
  { icon: 'card-outline', label: 'Payment methods', color: COLORS.primary },
  { icon: 'help-circle-outline', label: 'Help & support', color: COLORS.accent },
  { icon: 'document-text-outline', label: 'Terms & privacy', color: COLORS.primary },
];

export default function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchProfile();
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Close button */}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>

            {/* Profile header */}
            <View style={styles.profileHeader}>
              {/* Photo circle with edit */}
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

              {/* Badges */}
              <View style={styles.badgeRow}>
                {profile?.phone_verified && (
                  <View style={[styles.badge, styles.badgeGreen]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={[styles.badgeText, { color: '#10B981' }]}>Phone verified</Text>
                  </View>
                )}
                {profile?.aadhaar_verified ? (
                  <View style={[styles.badge, styles.badgeGreen]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={[styles.badgeText, { color: '#10B981' }]}>Aadhaar verified</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeOutline]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.textMut} />
                    <Text style={[styles.badgeText, { color: COLORS.textMut }]}>Aadhaar pending</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Menu items */}
            <View style={styles.menuSection}>
              {MENU_ITEMS.map((item, index) => (
                <TouchableOpacity key={index} style={styles.menuItem} activeOpacity={0.7}>
                  <View style={styles.menuLeft}>
                    <Ionicons name={item.icon as any} size={22} color={item.color} />
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMut} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
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

  badgeRow: { flexDirection: 'row', gap: SPACING.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.pill },
  badgeGreen: { backgroundColor: '#E6F9F0' },
  badgeOutline: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  badgeText: { fontSize: 12, ...FONTS.semibold },

  menuSection: { marginBottom: SPACING.lg },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuLabel: { fontSize: 16, color: COLORS.text, ...FONTS.medium },

  logoutBtn: { alignItems: 'center', paddingVertical: SPACING.md, backgroundColor: '#FFF0F0', borderRadius: RADIUS.md, marginTop: SPACING.sm },
  logoutText: { fontSize: 16, color: COLORS.danger, ...FONTS.semibold },
});