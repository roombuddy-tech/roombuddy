import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import type { HostTabParamList } from './types';

// Placeholder screens — replace with real screens later
function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title}</Text>
      <Text style={styles.placeholderSub}>Coming soon</Text>
    </View>
  );
}

function DashboardScreen() { return <PlaceholderScreen title="Dashboard" />; }
function ListingsScreen() { return <PlaceholderScreen title="My Listings" />; }
function BookingsScreen() { return <PlaceholderScreen title="Bookings" />; }
function MessagesScreen() { return <PlaceholderScreen title="Messages" />; }
function SettingsScreen() { return <PlaceholderScreen title="Settings" />; }

const Tab = createBottomTabNavigator<HostTabParamList>();

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { active: 'grid', inactive: 'grid-outline' },
  Listings: { active: 'home', inactive: 'home-outline' },
  Bookings: { active: 'calendar', inactive: 'calendar-outline' },
  Messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

export default function HostTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMut,
        tabBarLabelStyle: { fontSize: 11, ...FONTS.semibold, marginTop: -2 },
        tabBarStyle: {
          borderTopColor: COLORS.border,
          paddingTop: 6,
          height: 84,
        },
        tabBarIcon: ({ focused, color }) => {
          const icon = ICONS[route.name];
          const name = focused ? icon.active : icon.inactive;
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Listings" component={ListingsScreen} options={{ tabBarLabel: 'Listings' }} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  placeholderText: {
    fontSize: 24,
    ...FONTS.bold,
    color: COLORS.text,
  },
  placeholderSub: {
    fontSize: 14,
    color: COLORS.textMut,
    marginTop: 8,
  },
});