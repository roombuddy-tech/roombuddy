import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import ProfileMenu from '../screens/shared/ProfileMenu';
import type { GuestStackParamList, GuestTabParamList } from './types';

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title}</Text>
      <Text style={styles.placeholderSub}>Coming soon</Text>
    </View>
  );
}

function HomeScreen() {
  const { switchRole, user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const initial = (user?.first_name?.[0] || user?.display_name?.[0] || 'U').toUpperCase();
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();


  return (
    <View style={styles.homeContainer}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>Room<Text style={styles.brandAccent}>Buddy</Text></Text>
        <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)}>
          <Text style={styles.avatarText}>{initial.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Guest/Host toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity style={[styles.toggleBtn, styles.toggleActive]}>
          <Ionicons name="search-outline" size={16} color={COLORS.primary} />
          <Text style={styles.toggleActiveText}>Find a room</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toggleBtn} onPress={() => switchRole('host')}>
          <Ionicons name="home-outline" size={16} color={COLORS.textSec} />
          <Text style={styles.toggleText}>Host a room</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.contentArea}>
        <Text style={styles.sectionTitle}>Find your next stay</Text>
        <Text style={styles.sectionSub}>Short-term rooms in shared homes</Text>
        <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonIcon}>🏠</Text>
        <Text style={styles.comingSoonText}>Listings coming soon</Text>

        {/* DEV ONLY — remove when search/listing screens exist */}
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 10, paddingHorizontal: 18,
            backgroundColor: COLORS.accentAlpha, borderRadius: RADIUS.pill,
            marginTop: SPACING.md,
          }}
          onPress={() => navigation.navigate('BookTest' as never)}
        >
          <Ionicons name="construct-outline" size={16} color={COLORS.accent} />
          <Text style={{ color: COLORS.accent, ...FONTS.semibold, fontSize: 13 }}>
            Book a stay (test)
          </Text>
        </TouchableOpacity>
        </View>
      </View>

      <ProfileMenu visible={showProfile} onClose={() => setShowProfile(false)} />
    </View>
  );
}

function MyStaysScreen() { return <PlaceholderScreen title="My Stays" />; }
function MessagesScreen() { return <PlaceholderScreen title="Messages" />; }

const Tab = createBottomTabNavigator<GuestTabParamList>();

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'search', inactive: 'search-outline' },
  MyStays: { active: 'calendar', inactive: 'calendar-outline' },
  Messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
};

export default function GuestTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Explore' }} />
      <Tab.Screen name="MyStays" component={MyStaysScreen} options={{ tabBarLabel: 'My Stays' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  placeholderText: { fontSize: 24, ...FONTS.bold, color: COLORS.text },
  placeholderSub: { fontSize: 14, color: COLORS.textMut, marginTop: 8 },
  homeContainer: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60, paddingHorizontal: SPACING.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  brand: { fontSize: 22, ...FONTS.extrabold, color: COLORS.primaryDark, letterSpacing: -0.5 },
  brandAccent: { color: COLORS.accent },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, ...FONTS.bold },
  toggleRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.xl },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.sm },
  toggleActive: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  toggleText: { fontSize: 14, color: COLORS.textSec, ...FONTS.medium },
  toggleActiveText: { fontSize: 14, color: COLORS.primary, ...FONTS.semibold },
  contentArea: { flex: 1 },
  sectionTitle: { fontSize: 22, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  sectionSub: { fontSize: 14, color: COLORS.textSec, marginBottom: SPACING.xl },
  comingSoonCard: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, marginBottom: SPACING.xl },
  comingSoonIcon: { fontSize: 48, marginBottom: SPACING.md },
  comingSoonText: { fontSize: 16, color: COLORS.textMut, ...FONTS.medium },
});