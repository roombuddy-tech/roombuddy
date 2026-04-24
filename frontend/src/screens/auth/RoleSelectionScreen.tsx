import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import Button from '../../components/ui/Button';
import { authService } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'RoleSelection'>;

const ROLES = [
  {
    key: 'guest' as const,
    icon: '🔍',
    title: 'Find a room',
    description: 'Search and book affordable rooms in shared apartments across India.',
    features: ['Browse verified listings', 'Book for days or weeks', 'Kitchen access & home food'],
    color: COLORS.primary,
    bg: COLORS.primaryAlpha,
  },
  {
    key: 'host' as const,
    icon: '🏠',
    title: 'Host a room',
    description: 'List your spare room and earn ₹10K+ per month from verified guests.',
    features: ['Free to list', 'Verified guests only', 'We handle payments'],
    color: COLORS.accent,
    bg: COLORS.accentAlpha,
  },
];

export default function RoleSelectionScreen({}: Props) {
  const { selectRole } = useAuth();
  const [selected, setSelected] = useState<'guest' | 'host' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;

    setLoading(true);
    try {
      await authService.chooseRole(selected);
      await selectRole(selected);
      // AuthContext will trigger navigation to main app
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>How would you{'\n'}like to start?</Text>
          <Text style={styles.subtitle}>
            You can always switch between guest and host later.
          </Text>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          {ROLES.map((role) => {
            const isSelected = selected === role.key;
            return (
              <TouchableOpacity
                key={role.key}
                style={[
                  styles.card,
                  isSelected && { borderColor: role.color, ...SHADOW.md },
                ]}
                onPress={() => setSelected(role.key)}
                activeOpacity={0.8}
              >
                {/* Selection indicator */}
                <View style={[styles.radio, isSelected && { borderColor: role.color }]}>
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: role.color }]} />}
                </View>

                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: role.bg }]}>
                  <Text style={styles.icon}>{role.icon}</Text>
                </View>

                {/* Content */}
                <Text style={styles.cardTitle}>{role.title}</Text>
                <Text style={styles.cardDesc}>{role.description}</Text>

                {/* Features */}
                <View style={styles.features}>
                  {role.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Text style={[styles.featureCheck, { color: role.color }]}>✓</Text>
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Continue button */}
        <Button
          title={selected === 'host' ? 'Start hosting' : selected === 'guest' ? 'Start exploring' : 'Select a role'}
          onPress={handleContinue}
          variant={selected === 'host' ? 'accent' : 'primary'}
          size="lg"
          loading={loading}
          disabled={!selected}
          full
        />

        <Text style={styles.switchNote}>
          You can switch anytime from the app header
        </Text>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 30,
    ...FONTS.bold,
    color: COLORS.text,
    lineHeight: 38,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSec,
    lineHeight: 22,
  },
  cards: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  card: {
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg,
  },
  radio: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  icon: { fontSize: 28 },
  cardTitle: {
    fontSize: 20,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textSec,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  features: {
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureCheck: {
    fontSize: 14,
    ...FONTS.bold,
  },
  featureText: {
    fontSize: 13,
    color: COLORS.textSec,
    ...FONTS.medium,
  },
  switchNote: {
    fontSize: 13,
    color: COLORS.textMut,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});