import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import type { GuestTabParamList } from './types';

// Placeholder screens — replace with real screens later
function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title}</Text>
      <Text style={styles.placeholderSub}>Coming soon</Text>
    </View>
  );
}

function HomeScreen() { return <PlaceholderScreen title="Explore Rooms" />; }
function SearchScreen() { return <PlaceholderScreen title="Search" />; }
function MyStaysScreen() { return <PlaceholderScreen title="My Stays" />; }
function MessagesScreen() { return <PlaceholderScreen title="Messages" />; }
function ProfileScreen() { return <PlaceholderScreen title="Profile" />; }

const Tab = createBottomTabNavigator<GuestTabParamList>();

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  MyStays: { active: 'calendar', inactive: 'calendar-outline' },
  Messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export default function GuestTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Explore' }} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="MyStays" component={MyStaysScreen} options={{ tabBarLabel: 'My Stays' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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