import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

interface VerificationScreenProps {
  visible: boolean;
  onClose: () => void;
}

interface VerificationStatus {
  phone_verified: boolean;
  phone: string | null;
  email_verified: boolean;
  email: string | null;
  aadhaar_verified: boolean;
  id_verification_status: string;
  id_rejection_reason: string | null;
}

export default function VerificationScreen({ visible, onClose }: VerificationScreenProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [aadhaarUri, setAadhaarUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchStatus();
      setEmailSent(false);
      setAadhaarUri(null);
      setSelfieUri(null);
    }
  }, [visible]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.USER.VERIFICATION_STATUS);
      setStatus(res.data);
      if (res.data.email) setEmailInput(res.data.email);
    } catch (err) {
      console.log('Verification status error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setSendingEmail(true);
    try {
      await api.post(ENDPOINTS.USER.SEND_EMAIL_VERIFICATION, { email: emailInput.trim() });
      setEmailSent(true);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to send verification email.'));
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await api.get(ENDPOINTS.USER.VERIFICATION_STATUS);
      setStatus(res.data);
      if (res.data.email_verified) {
        Alert.alert('Verified!', 'Your email has been verified successfully.');
        setEmailSent(false);
      } else {
        Alert.alert('Not yet', 'Email not verified yet. Please check your inbox.');
      }
    } catch (err) {
      console.log('Check status error:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const pickImage = (setter: (uri: string) => void) => {
    Alert.alert('Choose an option', '', [
      {
        text: 'Take photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
          if (!result.canceled) setter(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
          if (!result.canceled) setter(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmitID = async () => {
    if (!aadhaarUri || !selfieUri) { Alert.alert('Missing photos', 'Please upload both your Aadhaar and a selfie.'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('aadhaar_image', { uri: aadhaarUri, type: 'image/jpeg', name: 'aadhaar.jpg' } as any);
      formData.append('selfie_image', { uri: selfieUri, type: 'image/jpeg', name: 'selfie.jpg' } as any);
      await api.post(ENDPOINTS.USER.SUBMIT_ID_VERIFICATION, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Submitted!', "Your documents are under review. We'll verify within 24-48 hours.");
      fetchStatus();
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to submit documents.'));
    } finally {
      setSubmitting(false);
    }
  };

  const idStatus = status?.id_verification_status || 'not_submitted';

  const getAadhaarIcon = () => {
    switch (idStatus) {
      case 'approved': return <Ionicons name="checkmark-circle" size={24} color="#10B981" />;
      case 'pending': return <Ionicons name="time" size={24} color="#F59E0B" />;
      case 'rejected': return <Ionicons name="close-circle" size={24} color="#EF4444" />;
      default: return <Ionicons name="chevron-forward" size={24} color={COLORS.textMut} />;
    }
  };

  const getAadhaarStatusText = () => {
    switch (idStatus) {
      case 'approved': return 'Verified';
      case 'pending': return 'Under review';
      case 'rejected': return 'Rejected — please resubmit';
      default: return 'Upload to verify your identity';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Phone */}
          <View style={styles.verifyCard}>
            <View style={styles.verifyRow}>
              <Ionicons name="call-outline" size={22} color={status?.phone_verified ? '#10B981' : COLORS.textMut} />
              <View style={styles.verifyContent}>
                <Text style={styles.verifyLabel}>Phone number</Text>
                <Text style={styles.verifyStatus}>{status?.phone_verified ? `Verified\n(${status.phone})` : 'Not verified'}</Text>
              </View>
              {status?.phone_verified ? <Ionicons name="checkmark-circle" size={24} color="#10B981" /> : <Ionicons name="close-circle-outline" size={24} color={COLORS.textMut} />}
            </View>
          </View>

          {/* Email */}
          <View style={styles.verifyCard}>
            <View style={styles.verifyRow}>
              <Ionicons name="mail-outline" size={22} color={status?.email_verified ? '#10B981' : COLORS.textMut} />
              <View style={styles.verifyContent}>
                <Text style={styles.verifyLabel}>Email address</Text>
                <Text style={styles.verifyStatus}>{status?.email_verified ? `Verified\n(${status.email})` : 'Not verified'}</Text>
              </View>
              {status?.email_verified ? <Ionicons name="checkmark-circle" size={24} color="#10B981" /> : <Ionicons name="close-circle-outline" size={24} color={COLORS.textMut} />}
            </View>

            {!status?.email_verified && (
              <View style={styles.emailSection}>
                {!emailSent ? (
                  <>
                    <View style={[styles.input, { backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center' }]}>                        <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMut} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 15, color: emailInput ? COLORS.text : COLORS.textMut, ...FONTS.medium, flex: 1 }}>
                        {emailInput || 'No email saved — add one in Edit Profile'}
                      </Text>
                    </View>
                    {emailInput ? (
                      <TouchableOpacity style={styles.sendBtn} onPress={handleSendVerification} disabled={sendingEmail}>
                        <Text style={styles.sendBtnText}>{sendingEmail ? 'Sending...' : 'Send verification email'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 13, color: COLORS.textMut, marginTop: 4 }}>Please add your email in Edit Profile first.</Text>
                    )}
                  </>
                ) : (
                  <View style={styles.sentSection}>
                    <View style={styles.sentIcon}><Ionicons name="mail-open-outline" size={32} color={COLORS.primary} /></View>
                    <Text style={styles.sentTitle}>Check your inbox</Text>
                    <Text style={styles.sentText}>We sent a verification link to{'\n'}<Text style={styles.sentEmail}>{emailInput}</Text></Text>
                    <Text style={styles.sentHint}>Click the link in the email, then tap the button below.</Text>
                    <TouchableOpacity style={styles.checkBtn} onPress={handleCheckStatus} disabled={checkingStatus}>
                      <Ionicons name="refresh-outline" size={18} color="#fff" />
                      <Text style={styles.checkBtnText}>{checkingStatus ? 'Checking...' : "I've verified — check status"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resendBtn} onPress={handleSendVerification} disabled={sendingEmail}>
                      <Text style={styles.resendText}>{sendingEmail ? 'Sending...' : 'Resend email'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Aadhaar / ID Verification */}
          <View style={styles.verifyCard}>
            <View style={styles.verifyRow}>
              <Ionicons name="id-card-outline" size={22} color={idStatus === 'approved' ? '#10B981' : idStatus === 'pending' ? '#F59E0B' : COLORS.textMut} />
              <View style={styles.verifyContent}>
                <Text style={styles.verifyLabel}>Aadhaar</Text>
                <Text style={[styles.verifyStatus, idStatus === 'rejected' && { color: '#EF4444' }]}>{getAadhaarStatusText()}</Text>
              </View>
              {getAadhaarIcon()}
            </View>

            {idStatus === 'rejected' && status?.id_rejection_reason && (
              <View style={styles.rejectionCard}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.rejectionText}>{status.id_rejection_reason}</Text>
              </View>
            )}

            {(idStatus === 'not_submitted' || idStatus === 'rejected') && (
              <View style={styles.uploadSection}>
                <Text style={styles.uploadLabel}>Aadhaar card photo</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setAadhaarUri)}>
                  {aadhaarUri ? (
                    <Image source={{ uri: aadhaarUri }} style={styles.uploadPreview} />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                      <Text style={styles.uploadPlaceholderText}>Tap to upload Aadhaar</Text>
                      <Text style={styles.uploadHint}>Front side, clearly visible</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={[styles.uploadLabel, { marginTop: SPACING.md }]}>Your selfie</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setSelfieUri)}>
                  {selfieUri ? (
                    <Image source={{ uri: selfieUri }} style={styles.uploadPreview} />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="person-circle-outline" size={28} color={COLORS.primary} />
                      <Text style={styles.uploadPlaceholderText}>Tap to take a selfie</Text>
                      <Text style={styles.uploadHint}>Clear, well-lit, face visible</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, (!aadhaarUri || !selfieUri) && styles.submitBtnDisabled]}
                  onPress={handleSubmitID}
                  disabled={!aadhaarUri || !selfieUri || submitting}
                >
                  {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit for verification</Text>}
                </TouchableOpacity>
              </View>
            )}

            {idStatus === 'pending' && (
              <View style={styles.pendingCard}>
                <View style={styles.pendingIcon}><Ionicons name="hourglass-outline" size={28} color="#F59E0B" /></View>
                <Text style={styles.pendingTitle}>Under review</Text>
                <Text style={styles.pendingText}>We're reviewing your documents. This usually takes 24-48 hours.</Text>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchStatus}>
                  <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.refreshBtnText}>Check status</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>Verifying your identity helps build trust with other users and unlocks additional features. Your Aadhaar photo is stored securely and never shared publicly.</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  headerTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  content: { marginTop: SPACING.md },
  verifyCard: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  verifyContent: { flex: 1 },
  verifyLabel: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  verifyStatus: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  emailSection: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, marginBottom: SPACING.sm },
  sendBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontSize: 14, ...FONTS.semibold },
  sentSection: { alignItems: 'center', paddingVertical: SPACING.md },
  sentIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  sentTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.xs },
  sentText: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 22 },
  sentEmail: { color: COLORS.text, ...FONTS.semibold },
  sentHint: { fontSize: 13, color: COLORS.textMut, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.lg },
  checkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: RADIUS.md },
  checkBtnText: { color: '#fff', fontSize: 14, ...FONTS.semibold },
  resendBtn: { marginTop: SPACING.md },
  resendText: { fontSize: 14, color: COLORS.primary, ...FONTS.semibold },
  uploadSection: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  uploadLabel: { fontSize: 14, ...FONTS.semibold, color: COLORS.text, marginBottom: 8 },
  uploadBox: { borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: RADIUS.md, overflow: 'hidden', minHeight: 140 },
  uploadPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl, gap: 6 },
  uploadPlaceholderText: { fontSize: 14, ...FONTS.medium, color: COLORS.primary },
  uploadHint: { fontSize: 12, color: COLORS.textMut },
  uploadPreview: { width: '100%', height: 180, resizeMode: 'cover' },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.lg },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 15, ...FONTS.semibold },
  rejectionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', padding: SPACING.sm, borderRadius: RADIUS.sm, marginTop: SPACING.sm },
  rejectionText: { flex: 1, fontSize: 13, color: '#EF4444', lineHeight: 19 },
  pendingCard: { alignItems: 'center', paddingVertical: SPACING.lg, marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  pendingIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF6EE', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  pendingTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  pendingText: { fontSize: 13, color: COLORS.textSec, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.md },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md },
  refreshBtnText: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: SPACING.md, backgroundColor: COLORS.primaryAlpha, borderRadius: RADIUS.md, marginTop: SPACING.md },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primary, lineHeight: 19 },
});