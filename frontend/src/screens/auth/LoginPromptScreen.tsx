import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

export default function LoginPromptScreen({ icon, title, subtitle }: Props) {
  const navigation = useNavigation<any>();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={40} color={COLORS.accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginBtnText}>Login to continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      ...FONTS.bold,
      color: COLORS.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: COLORS.textMut,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    loginBtn: {
      backgroundColor: COLORS.accent,
      paddingVertical: 14,
      paddingHorizontal: 48,
      borderRadius: RADIUS.pill,
    },
    loginBtnText: {
      color: '#fff',
      fontSize: 16,
      ...FONTS.bold,
    },
  });
