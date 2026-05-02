import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import GuestStack from './GuestStack';
import HostStack from './HostStack';

export default function Navigation() {
  const { isLoading, isAuthenticated, isProfileComplete, userRole } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated || !isProfileComplete ? (
        <AuthStack />
      ) : userRole === 'host' ? (
        <HostStack />
      ) : (
        <GuestStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
});