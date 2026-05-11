import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import BookingDetailScreen from '../screens/host/BookingDetailScreen';
import ListingEditorScreen from '../screens/host/ListingEditorScreen';
import PauseListingScreen from '../screens/host/PauseListingScreen';
import ListingDetailScreen from '../screens/shared/ListingDetailScreen';
import NotificationPreferencesScreen from '../screens/shared/NotificationPreferencesScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import HostTabs from './HostTabs';
import type { HostStackParamList } from './types';

const Stack = createNativeStackNavigator<HostStackParamList>();

export default function HostStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HostTabs" component={HostTabs} />
      <Stack.Screen
        name="ListingEditor"
        component={ListingEditorScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <Stack.Screen name="PauseListing" component={PauseListingScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: 'Notification preferences' }}/>
    </Stack.Navigator>
  );
}
