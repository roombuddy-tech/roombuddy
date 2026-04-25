import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  const { isLoading, isAuthenticated, isProfileComplete } = useAuth();
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        navigation.replace('Login');
      } else if (!isProfileComplete) {
        navigation.replace('ProfileSetup');
      }
      // If profile complete, Navigation index.tsx shows GuestTabs
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, isProfileComplete]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🏠</Text>
        </View>
        <Text style={styles.brand}>
          Room<Text style={styles.brandAccent}>Buddy</Text>
        </Text>
        <Text style={styles.tagline}>Stays that feel like home</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
  },
  brand: {
    fontSize: 42,
    ...FONTS.extrabold,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  brandAccent: {
    color: COLORS.accent,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    letterSpacing: 2,
    ...FONTS.medium,
  },
});