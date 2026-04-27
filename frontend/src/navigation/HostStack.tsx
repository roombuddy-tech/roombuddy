import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HostTabs from './HostTabs';
import ListingEditorScreen from '../screens/host/ListingEditorScreen';
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
    </Stack.Navigator>
  );
}
