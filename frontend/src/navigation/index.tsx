import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
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
// open the app via Universal Links (iOS) / App Links (Android) — configured
// in app.config.js/entitlements, unaffected by anything below. Getting the
// OS to open the app is only half the job though: once inside, something
// still has to route to the right screen.
//
// React Navigation's own declarative `linking` config (NavigationContainer's
// `linking` prop) is the usual way to do that, but it doesn't resolve
// reliably here: this app swaps between four *entirely different* root
// navigators depending on auth state (AuthStack / BrowseStack /
// ProfileIncompleteStack / RoleTabs), rather than one root with conditional
// screens — plus RoleTabs is a material-top-tab navigator wrapping nested
// stacks. That shape isn't what the automatic path-matching is built for, and
// in testing it consistently fell back to the default screen instead of the
// shared listing. So this reads the incoming URL directly and navigates
// imperatively instead, which sidesteps that matching entirely.
function parseSharedListingId(url: string | null): string | null {
  if (!url) return null;
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return null;
  return new URLSearchParams(url.slice(queryIndex + 1)).get('listingId');
}

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

  // Handle a shared listing link — both the cold-start case (app was closed,
  // this URL is why it launched) and the warm case (app already running).
  // The navigator may not be mounted/ready yet right after a cold start, so
  // retry briefly rather than giving up on the first check.
  const navigateToSharedListing = useCallback((url: string | null) => {
    const listingId = parseSharedListingId(url);
    if (!listingId) return;

    const tryNavigate = (attemptsLeft: number) => {
      if (navRef.isReady()) {
        (navRef as any).navigate('GuestListingDetail', { listingId });
      } else if (attemptsLeft > 0) {
        setTimeout(() => tryNavigate(attemptsLeft - 1), 150);
      }
    };
    tryNavigate(20); // up to ~3s for the navigator to mount after a cold start
  }, [navRef]);

  useEffect(() => {
    Linking.getInitialURL().then(navigateToSharedListing);
    const sub = Linking.addEventListener('url', ({ url }) => navigateToSharedListing(url));
    return () => sub.remove();
  }, [navigateToSharedListing]);

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
    <NavigationContainer ref={navRef} onStateChange={handleStateChange}>
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
