import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ENDPOINTS } from '../../constants/endpoints';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

interface PaymentMethodsScreenProps {
  visible: boolean;
  onClose: () => void;
}

interface PayoutAccount {
  id: string;
  account_type: string;
  is_primary: boolean;
  account_holder_name: string | null;
  account_number_masked: string;
  ifsc_code: string | null;
  bank_name: string | null;
  upi_id: string | null;
}

type AddMode = 'none' | 'bank' | 'upi';

export default function PaymentMethodsScreen({ visible, onClose }: PaymentMethodsScreenProps) {
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>('none');
  const [saving, setSaving] = useState(false);

  // Bank fields
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  // UPI field
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    if (visible) fetchAccounts();
  }, [visible]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.USER.PAYOUT_ACCOUNTS);
      setAccounts(res.data.results);
    } catch (err) {
      console.log('Fetch payout accounts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAddMode('none');
    setHolderName('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfsc('');
    setBankName('');
    setUpiId('');
  };

  const handleAddBank = async () => {
    if (!holderName || !accountNumber || !confirmAccountNumber || !ifsc || !bankName) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      Alert.alert('Error', 'Account numbers do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.post(ENDPOINTS.USER.ADD_BANK, {
        account_holder_name: holderName.trim(),
        account_number: accountNumber.trim(),
        confirm_account_number: confirmAccountNumber.trim(),
        ifsc_code: ifsc.trim().toUpperCase(),
        bank_name: bankName.trim(),
      });
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to add bank account.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddUPI = async () => {
    if (!upiId || !upiId.includes('@')) {
      Alert.alert('Error', 'Enter a valid UPI ID (e.g. name@upi).');
      return;
    }
    setSaving(true);
    try {
      await api.post(ENDPOINTS.USER.ADD_UPI, { upi_id: upiId.trim() });
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to add UPI.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (account: PayoutAccount) => {
    const label = account.account_type === 'bank' ? `Bank ${account.account_number_masked}` : `UPI ${account.upi_id}`;
    Alert.alert('Delete', `Remove ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`${ENDPOINTS.USER.PAYOUT_ACCOUNTS}${account.id}/delete/`);
            fetchAccounts();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      await api.post(`${ENDPOINTS.USER.PAYOUT_ACCOUNTS}${accountId}/set-primary/`);
      fetchAccounts();
    } catch (err) {
      Alert.alert('Error', 'Failed to set as primary.');
    }
  };

  // Add bank form
  if (addMode === 'bank') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetForm}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add bank account</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Text style={styles.label}>Account holder name</Text>
            <TextInput style={styles.input} value={holderName} onChangeText={setHolderName} placeholder="As per bank records" placeholderTextColor={COLORS.textMut} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Account number</Text>
            <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="Account number" placeholderTextColor={COLORS.textMut} keyboardType="number-pad" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Confirm account number</Text>
            <TextInput style={styles.input} value={confirmAccountNumber} onChangeText={setConfirmAccountNumber} placeholder="Re-enter account number" placeholderTextColor={COLORS.textMut} keyboardType="number-pad" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>IFSC code</Text>
            <TextInput style={styles.input} value={ifsc} onChangeText={setIfsc} placeholder="e.g. SBIN0001234" placeholderTextColor={COLORS.textMut} autoCapitalize="characters" maxLength={11} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Bank name</Text>
            <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g. State Bank of India" placeholderTextColor={COLORS.textMut} />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleAddBank} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Add bank account'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Add UPI form
  if (addMode === 'upi') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetForm}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add UPI ID</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>UPI ID</Text>
          <TextInput style={styles.input} value={upiId} onChangeText={setUpiId} placeholder="e.g. name@upi or name@okaxis" placeholderTextColor={COLORS.textMut} autoCapitalize="none" />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleAddUPI} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Add UPI'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Main list
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment methods</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Add buttons */}
          <View style={styles.addRow}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddMode('bank')}>
              <Ionicons name="business-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Add bank account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddMode('upi')}>
              <Ionicons name="phone-portrait-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Add UPI</Text>
            </TouchableOpacity>
          </View>

          {/* Account list */}
          {accounts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.iconCircle}>
                <Ionicons name="card-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No payment methods</Text>
              <Text style={styles.emptyText}>Add your bank account or UPI to receive payouts when bookings go live.</Text>
            </View>
          ) : (
            accounts.map((acc) => (
              <View key={acc.id} style={styles.accountCard}>
                <View style={styles.accountRow}>
                  <Ionicons name={acc.account_type === 'bank' ? 'business-outline' : 'phone-portrait-outline'} size={22} color={COLORS.primary} />
                  <View style={styles.accountContent}>
                    {acc.account_type === 'bank' ? (
                      <>
                        <Text style={styles.accountLabel}>{acc.bank_name}</Text>
                        <Text style={styles.accountSub}>{acc.account_holder_name} · {acc.account_number_masked}</Text>
                        <Text style={styles.accountSub}>IFSC: {acc.ifsc_code}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.accountLabel}>UPI</Text>
                        <Text style={styles.accountSub}>{acc.upi_id}</Text>
                      </>
                    )}
                  </View>
                  {acc.is_primary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryText}>Primary</Text>
                    </View>
                  )}
                </View>
                <View style={styles.accountActions}>
                  {!acc.is_primary && (
                    <TouchableOpacity onPress={() => handleSetPrimary(acc.id)}>
                      <Text style={styles.actionText}>Set as primary</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(acc)}>
                    <Text style={styles.deleteText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  headerTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },

  addRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.md, borderStyle: 'dashed' },
  addBtnText: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryAlpha, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text, marginBottom: SPACING.sm },
  emptyText: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.lg },

  accountCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  accountRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  accountContent: { flex: 1 },
  accountLabel: { fontSize: 15, ...FONTS.semibold, color: COLORS.text },
  accountSub: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  primaryBadge: { backgroundColor: '#E6F9F0', paddingVertical: 4, paddingHorizontal: 10, borderRadius: RADIUS.pill },
  primaryText: { fontSize: 11, color: '#10B981', ...FONTS.semibold },
  accountActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.lg, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionText: { fontSize: 13, color: COLORS.primary, ...FONTS.semibold },
  deleteText: { fontSize: 13, color: COLORS.danger, ...FONTS.semibold },

  field: { marginBottom: SPACING.lg, marginTop: SPACING.sm },
  label: { fontSize: 14, color: COLORS.textSec, ...FONTS.semibold, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.bg, ...FONTS.medium },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  saveBtnText: { color: '#fff', fontSize: 16, ...FONTS.semibold },
});