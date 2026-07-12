import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { FONTS, ThemeColors } from '../constants/theme';
import { useThemeColors } from '../context/ThemeContext';
import LoginPromptScreen from '../screens/auth/LoginPromptScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import GuestListingDetailScreen from '../screens/guest/ListingDetailScreen';
import HomeScreen from '../screens/guest/HomeScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MyStaysPrompt() {
  return (
    <LoginPromptScreen
      icon="calendar-outline"
      title="Your stays"
      subtitle="Login to view your bookings, check-in details, and stay history."
    />
  );
}

function MessagesPrompt() {
  return (
    <LoginPromptScreen
      icon="chatbubble-ellipses-outline"
      title="Messages"
      subtitle="Login to chat with hosts and manage your conversations."
    />
  );
}

function BrowseTabs() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSec,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Explore',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={focused ? 'compass' : 'compass-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="MyStays"
        component={MyStaysPrompt}
        options={{
          tabBarLabel: 'My Stays',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={focused ? 'calendar-check' : 'calendar-check-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesPrompt}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={focused ? 'message-text' : 'message-text-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function BrowseStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrowseTabs" component={BrowseTabs} />
      <Stack.Screen name="GuestListingDetail" component={GuestListingDetailScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: COLORS.bg,
      borderTopWidth: 0.5,
      borderTopColor: COLORS.border,
      paddingTop: 8,
      paddingBottom: 28,
      height: 88,
      elevation: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    tabBarItem: {
      paddingVertical: 4,
    },
    tabLabel: {
      fontSize: 10,
      ...FONTS.semibold,
      marginTop: 2,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
    },
  });
