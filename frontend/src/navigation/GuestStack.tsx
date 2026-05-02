import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import BookTestScreen from '../screens/guest/BookTestScreen';
import BookingConfirmScreen from '../screens/guest/BookingConfirmScreen';
import BookingSuccessScreen from '../screens/guest/BookingSuccessScreen';
import RazorpayCheckoutScreen from '../screens/guest/RazorpayCheckoutScreen';
import GuestTabs from './GuestTabs';
import type { GuestStackParamList } from './types';

const Stack = createNativeStackNavigator<GuestStackParamList>();

export default function GuestStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GuestTabs" component={GuestTabs} />
      <Stack.Screen name="BookTest" component={BookTestScreen} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
      <Stack.Screen name="RazorpayCheckout" component={RazorpayCheckoutScreen} />
      <Stack.Screen
        name="BookingSuccess"
        component={BookingSuccessScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}