import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { LinkingOptions } from '@react-navigation/native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../context/ThemeContext';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import AuthStack from './AuthStack';
import BrowseStack from './BrowseStack';
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

/**
 * Guest and Host live side by side in a swipeable pager (tab bar hidden), so
 * dragging carries the neighbouring mode in with your finger — no blank gap.
 * Both trees stay mounted, which is what makes the transition continuous.
 */
const RoleTab = createMaterialTopTabNavigator();

const GUEST_ROUTE = 'GuestRole';
const HOST_ROUTE = 'HostRole';
/** Root screens of each stack — swiping is only allowed while on these. */
const TAB_ROOTS = ['GuestTabs', 'HostTabs'];

// Shared listing links (https://roombuddy.co.in/listing.html?listingId=...)
// open straight to the listing when the app is installed — via Universal
// Links (iOS) / App Links (Android), configured in app.config.js. This maps
// that URL to the "GuestListingDetail" screen wherever it's currently
// mounted: directly under BrowseStack when logged out, or nested under the
// Guest tab of RoleTabs when logged in. Only one of these is ever actually
// present at a time, so listing them both here is harmless.
const linking: LinkingOptions<any> = {
  prefixes: ['https://roombuddy.co.in'],
  config: {
    screens: {
      GuestListingDetail: 'listing.html',
      [GUEST_ROUTE]: {
        screens: {
          GuestListingDetail: 'listing.html',
        },
      },
    },
  },
};

function RoleTabs({ swipeEnabled }: { swipeEnabled: boolean }) {
  const { userRole, switchRole } = useAuth();

  return (
    <RoleTab.Navigator
      initialRouteName={userRole === 'host' ? HOST_ROUTE : GUEST_ROUTE}
      tabBar={() => null}
      screenOptions={{
        swipeEnabled,
        lazy: false, // keep both mounted so the neighbour is visible mid-swipe
      }}
      screenListeners={{
        state: (e: any) => {
          const idx = e?.data?.state?.index;
          if (idx == null) return;
          const role = idx === 1 ? 'host' : 'guest';
          if (role !== userRole) switchRole(role);
        },
      }}
    >
      <RoleTab.Screen name={GUEST_ROUTE} component={GuestStack} />
      <RoleTab.Screen name={HOST_ROUTE} component={HostStack} />
    </RoleTab.Navigator>
  );
}

export default function Navigation() {
  const { isLoading, isAuthenticated, isProfileComplete, userRole, didLogout } = useAuth();
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const navRef = useNavigationContainerRef();
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  const showRolePager = isAuthenticated && isProfileComplete;

  // Drive the pager when the role is changed elsewhere (the header toggle).
  useEffect(() => {
    if (!showRolePager || !navRef.isReady()) return;
    navRef.navigate((userRole === 'host' ? HOST_ROUTE : GUEST_ROUTE) as never);
  }, [userRole, showRolePager, navRef]);

  // Only allow the role swipe on each stack's root tabs — detail screens have
  // their own horizontal gestures (photo carousels, maps) that must win.
  const handleStateChange = useCallback(() => {
    if (!showRolePager || !navRef.isReady()) return;
    try {
      const root: any = navRef.getRootState();
      const roleRoute = root?.routes?.[root.index];
      const stackState = roleRoute?.state;
      if (!stackState) {
        setSwipeEnabled(true);
        return;
      }
      const current = stackState.routes[stackState.index];
      setSwipeEnabled(TAB_ROOTS.includes(current?.name));
    } catch {
      setSwipeEnabled(true);
    }
  }, [showRolePager, navRef]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef} onStateChange={handleStateChange} linking={linking}>
      {!isAuthenticated && didLogout ? (
        <AuthStack />
      ) : !isAuthenticated ? (
        <BrowseStack />
      ) : !isProfileComplete ? (
        <ProfileIncompleteStack />
      ) : (
        <RoleTabs swipeEnabled={swipeEnabled} />
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
