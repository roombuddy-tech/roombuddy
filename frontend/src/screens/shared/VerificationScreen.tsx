import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

interface VerificationScreenProps {
  visible: boolean;
  onClose: () => void;
}

interface VerificationStatus {
  phone_verified: boolean;
  email_verified: boolean;
  email: string | null;
  aadhaar_verified: boolean;
}

export default function VerificationScreen({ visible, onClose }: VerificationScreenProps) {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchStatus();
      setEmailSent(false);
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
    if (!emailInput.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
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
        Alert.alert('Not yet', 'Email not verified yet. Please check your inbox and click the verification link.');
      }
    } catch (err) {
      console.log('Check status error:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Phone */}
          <View style={styles.verifyCard}>
            <View style={styles.verifyRow}>
              <Ionicons name="call-outline" size={22} color={status?.phone_verified ? '#10B981' : COLORS.textMut} />
              <View style={styles.verifyContent}>
                <Text style={styles.verifyLabel}>Phone number</Text>
                <Text style={styles.verifyStatus}>{status?.phone_verified ? 'Verified' : 'Not verified'}</Text>
              </View>
              {status?.phone_verified ? (
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              ) : (
                <Ionicons name="close-circle-outline" size={24} color={COLORS.textMut} />
              )}
            </View>
          </View>

          {/* Email */}
          <View style={styles.verifyCard}>
            <View style={styles.verifyRow}>
              <Ionicons name="mail-outline" size={22} color={status?.email_verified ? '#10B981' : COLORS.textMut} />
              <View style={styles.verifyContent}>
                <Text style={styles.verifyLabel}>Email address</Text>
                <Text style={styles.verifyStatus}>
                  {status?.email_verified ? `Verified (${status.email})` : 'Not verified'}
                </Text>
              </View>
              {status?.email_verified ? (
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              ) : (
                <Ionicons name="close-circle-outline" size={24} color={COLORS.textMut} />
              )}
            </View>

            {!status?.email_verified && (
              <View style={styles.emailSection}>
                {!emailSent ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={emailInput}
                      onChangeText={setEmailInput}
                      placeholder="Enter email address"
                      placeholderTextColor={COLORS.textMut}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={handleSendVerification} disabled={sendingEmail}>
                      <Text style={styles.sendBtnText}>{sendingEmail ? 'Sending...' : 'Send verification email'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.sentSection}>
                    <View style={styles.sentIcon}>
                      <Ionicons name="mail-open-outline" size={32} color={COLORS.primary} />
                    </View>
                    <Text style={styles.sentTitle}>Check your inbox</Text>
                    <Text style={styles.sentText}>
                      We sent a verification link to{'\n'}
                      <Text style={styles.sentEmail}>{emailInput}</Text>
                    </Text>
                    <Text style={styles.sentHint}>Click the link in the email, then tap the button below.</Text>

                    <TouchableOpacity style={styles.checkBtn} onPress={handleCheckStatus} disabled={checkingStatus}>
                      <Ionicons name="refresh-outline" size={18} color="#fff" />
                      <Text style={styles.checkBtnText}>{checkingStatus ? 'Checking...' : 'I\'ve verified — check status'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.resendBtn} onPress={handleSendVerification} disabled={sendingEmail}>
                      <Text style={styles.resendText}>{sendingEmail ? 'Sending...' : 'Resend email'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Aadhaar */}
          <View style={styles.verifyCard}>
            <View style={styles.verifyRow}>
              <Ionicons name="id-card-outline" size={22} color={COLORS.textMut} />
              <View style={styles.verifyContent}>
                <Text style={styles.verifyLabel}>Aadhaar</Text>
                <Text style={styles.verifyStatus}>Coming soon</Text>
              </View>
              <Ionicons name="time-outline" size={24} color={COLORS.textMut} />
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Verifying your identity helps build trust with other users and unlocks additional features.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 15, color: COLORS.text, ...FONTS.medium, marginBottom: SPACING.sm },
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

  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: SPACING.md, backgroundColor: COLORS.primaryAlpha, borderRadius: RADIUS.md, marginTop: SPACING.md },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primary, lineHeight: 18 },
});