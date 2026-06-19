import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import BookTestScreen from '../screens/guest/BookTestScreen';
import BookingConfirmScreen from '../screens/guest/BookingConfirmScreen';
import BookingSuccessScreen from '../screens/guest/BookingSuccessScreen';
import GuestListingDetailScreen from '../screens/guest/ListingDetailScreen';
import RazorpayCheckoutScreen from '../screens/guest/RazorpayCheckoutScreen';
import WriteReviewScreen from '../screens/guest/WriteReviewScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import NotificationPreferencesScreen from '../screens/shared/NotificationPreferencesScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import GuestTabs from './GuestTabs';
import type { GuestStackParamList } from './types';

const Stack = createNativeStackNavigator<GuestStackParamList>();

export default function GuestStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GuestTabs" component={GuestTabs} />
      <Stack.Screen name="GuestListingDetail" component={GuestListingDetailScreen} />
      <Stack.Screen name="BookTest" component={BookTestScreen} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
      <Stack.Screen name="RazorpayCheckout" component={RazorpayCheckoutScreen} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ gestureEnabled: false }}/>
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: 'Notification preferences' }}/>
      <Stack.Screen name="WriteReview" component={WriteReviewScreen} />
    </Stack.Navigator>
  );
}