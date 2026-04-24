import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import GuestTabs from './GuestTabs';
import HostTabs from './HostTabs';
import { COLORS } from '../constants/theme';

export default function Navigation() {
  const { isLoading, isAuthenticated, isProfileComplete, hasChosenRole, userRole } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated || !isProfileComplete || !hasChosenRole ? (
        <AuthStack />
      ) : userRole === 'host' ? (
        <HostTabs />
      ) : (
        <GuestTabs />
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