import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import EditProfileScreen from './EditProfileScreen';
import HelpSupportScreen from './HelpSupportScreen';
import PaymentMethodsScreen from './PaymentMethodsScreen';
import TermsPrivacyScreen from './TermsPrivacyScreen';
import VerificationScreen from './VerificationScreen';


type SubScreen = 'none' | 'edit_profile' | 'verification' | 'payment' | 'help' | 'terms';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  initialScreen?: SubScreen;
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
  profile_photo_url: string | null;
}

export default function ProfileMenu({ visible, onClose, initialScreen }: ProfileMenuProps) {
  const { logout } = useAuth();
  const { mode, colors: COLORS, toggle } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeScreen, setActiveScreen] = useState<SubScreen>('none');

  useEffect(() => {
    if (visible) {
      fetchProfile();
      setActiveScreen(initialScreen || 'none');
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

const handlePickPhoto = async () => {
    Alert.alert('Profile photo', 'Choose an option', [
      {
        text: 'Take photo',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission needed', 'Go to Settings and enable camera access for Expo Go.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) uploadPhoto(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) uploadPhoto(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(ENDPOINTS.USER.DELETE_ACCOUNT);
              await logout();
              Alert.alert('Account deleted', 'Your account has been deleted.');
            } catch {
              Alert.alert('Error', 'Could not delete account. Please contact support.');
            }
          },
        },
      ],
    );
  };

  const uploadPhoto = async (uri: string) => {
    const formData = new FormData();
    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    } as any);

    try {
      await api.post(ENDPOINTS.USER.UPLOAD_PHOTO, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchProfile();
      Alert.alert('Success', 'Profile photo updated.');
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to upload photo.'));
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
                {profile?.profile_photo_url ? (
                  <Image source={{ uri: profile.profile_photo_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{profile?.initials || 'U'}</Text>
                )}
              </View>
                <TouchableOpacity style={styles.editBadge} onPress={handlePickPhoto}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.userName}>{profile?.display_name || 'User'}</Text>
              <Text style={styles.userMeta}>
                {profile?.member_since ? `Member since ${profile.member_since}` : ''}
              </Text>

              <View style={styles.badgeRow}>
                <View style={[styles.badge, profile?.phone_verified ? styles.badgeGreen : styles.badgeWarning]}>
                  <Ionicons
                    name={profile?.phone_verified ? 'checkmark-circle' : 'alert-circle-outline'}
                    size={14}
                    color={profile?.phone_verified ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={[styles.badgeText, { color: profile?.phone_verified ? '#10B981' : '#F59E0B' }]}>Phone</Text>
                </View>
                <TouchableOpacity
                  style={[styles.badge, profile?.email_verified ? styles.badgeGreen : styles.badgeWarning]}
                  onPress={profile?.email_verified ? undefined : () => setActiveScreen('verification')}
                >
                  <Ionicons
                    name={profile?.email_verified ? 'checkmark-circle' : 'alert-circle-outline'}
                    size={14}
                    color={profile?.email_verified ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={[styles.badgeText, { color: profile?.email_verified ? '#10B981' : '#F59E0B' }]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.badge, profile?.aadhaar_verified ? styles.badgeSuccess : styles.badgeWarning]}
                  onPress={() => setActiveScreen('verification')}
                >
                  <Ionicons
                    name={profile?.aadhaar_verified ? 'checkmark-circle' : 'time-outline'}
                    size={14}
                    color={profile?.aadhaar_verified ? '#10B981' : COLORS.textMut}
                  />
                  <Text style={[styles.badgeText, { color: profile?.aadhaar_verified ? '#10B981' : COLORS.textMut }]}>
                    Aadhaar
                  </Text>
                </TouchableOpacity>
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

              <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                <View style={styles.menuLeft}>
                  <Ionicons name={mode === 'dark' ? 'moon-outline' : 'sunny-outline'} size={22} color={COLORS.primary} />
                  <Text style={styles.menuLabel}>Dark mode</Text>
                </View>
                <Switch
                  value={mode === 'dark'}
                  onValueChange={toggle}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.surface}
                  ios_backgroundColor={COLORS.border}
                />
              </View>

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

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.deleteText}>Delete my account</Text>
            </TouchableOpacity>

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

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  closeBtn: { alignSelf: 'flex-end', padding: SPACING.sm, marginTop: SPACING.sm },
  profileHeader: { alignItems: 'center', marginBottom: SPACING.xl },
  avatarWrapper: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  avatarInitials: { fontSize: 32, ...FONTS.bold, color: COLORS.primary },
  avatarImage: { width: 86, height: 86, borderRadius: 43 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.bg },
  badgeSuccess: { backgroundColor: '#E6F9F0', borderColor: '#C5EDDA' },
  userName: { fontSize: 24, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
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
  deleteBtn: { alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  deleteText: { fontSize: 14, color: COLORS.danger, ...FONTS.medium, textDecorationLine: 'underline' },
});
