import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../context/ThemeContext';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import AuthStack from './AuthStack';
import GuestStack from './GuestStack';
import HostStack from './HostStack';

const ProfileStack = createNativeStackNavigator();

function ProfileIncompleteStack() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </ProfileStack.Navigator>
  );
}

export default function Navigation() {
  const { isLoading, isAuthenticated, isProfileComplete, userRole } = useAuth();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack />
      ) : !isProfileComplete ? (
        <ProfileIncompleteStack />
      ) : userRole === 'host' ? (
        <HostStack />
      ) : (
        <GuestStack />
      )}
    </NavigationContainer>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
});
