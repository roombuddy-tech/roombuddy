import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import HomeScreen from '../screens/guest/HomeScreen';
import type { GuestTabParamList } from './types';

function PlaceholderScreen({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.placeholder}>
      <MaterialCommunityIcons name={icon as any} size={48} color={COLORS.border} />
      <Text style={styles.placeholderText}>{title}</Text>
      <Text style={styles.placeholderSub}>Coming soon</Text>
    </View>
  );
}

function MyStaysScreen() { return <PlaceholderScreen title="My Stays" icon="calendar-check-outline" />; }
function MessagesScreen() { return <PlaceholderScreen title="Messages" icon="message-text-outline" />; }
function HostSwitchScreen() { return <View />; }

const Tab = createBottomTabNavigator<GuestTabParamList>();

export default function GuestTabs() {
  const { switchRole } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMut,
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
        component={MyStaysScreen}
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
        component={MessagesScreen}
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
      <Tab.Screen
        name="HostSwitch"
        component={HostSwitchScreen}
        options={{
          tabBarLabel: 'Host',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="home-switch-outline" size={24} color={color} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            switchRole('host');
          },
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
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    gap: 8,
  },
  placeholderText: { fontSize: 22, ...FONTS.bold, color: COLORS.text },
  placeholderSub: { fontSize: 14, color: COLORS.textMut },
});