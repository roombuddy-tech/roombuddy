import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import BookingsScreen from '../screens/host/BookingsScreen';
import DashboardScreen from '../screens/host/DashboardScreen';
import EarningsScreen from '../screens/host/EarningsScreen';
import ListingsScreen from '../screens/host/ListingsScreen';
import type { HostTabParamList } from './types';

const Tab = createBottomTabNavigator<HostTabParamList>();

export default function HostTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMut,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Today"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Today',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={focused ? 'view-dashboard' : 'view-dashboard-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Listing"
        component={ListingsScreen}
        options={{
          tabBarLabel: 'Listings',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={focused ? 'home-city' : 'home-city-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{
          tabBarLabel: 'Bookings',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={focused ? 'book-open-page-variant' : 'book-open-page-variant-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={focused ? 'chart-line' : 'chart-line-variant'}
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

const styles = StyleSheet.create({
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