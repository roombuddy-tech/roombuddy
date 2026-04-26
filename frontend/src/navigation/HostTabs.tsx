import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import DashboardScreen from '../screens/host/DashboardScreen';
import BookingsScreen from '../screens/host/BookingsScreen';
import EarningsScreen from '../screens/host/EarningsScreen';
import ListingsScreen from '../screens/host/ListingsScreen';
import type { HostTabParamList } from './types';

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title}</Text>
      <Text style={styles.placeholderSub}>Coming soon</Text>
    </View>
  );
}

function CalendarScreen() { return <PlaceholderScreen title="Calendar" />; }
function SettingsScreen() { return <PlaceholderScreen title="Settings" />; }

const Tab = createBottomTabNavigator<HostTabParamList>();

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Today: { active: 'home', inactive: 'home-outline' },
  Calendar: { active: 'calendar', inactive: 'calendar-outline' },
  Listing: { active: 'document-text', inactive: 'document-text-outline' },
  Bookings: { active: 'book', inactive: 'book-outline' },
  Earnings: { active: 'cash', inactive: 'cash-outline' },
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
        tabBarStyle: { borderTopColor: COLORS.border, paddingTop: 6, height: 84 },
        tabBarIcon: ({ focused, color }) => {
          const icon = ICONS[route.name];
          const name = focused ? icon.active : icon.inactive;
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Today" component={DashboardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Listing" component={ListingsScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  placeholderText: { fontSize: 24, ...FONTS.bold, color: COLORS.text },
  placeholderSub: { fontSize: 14, color: COLORS.textMut, marginTop: 8 },
});