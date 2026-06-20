import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import { FONTS, ThemeColors } from '../constants/theme';
import { useThemeColors } from '../context/ThemeContext';
import { listNotifications } from '../services/notifications';

export default function NotificationBell({ style }: { style?: ViewStyle }) {
  const navigation = useNavigation<any>();
  const [count, setCount] = useState(0);
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listNotifications()
        .then((res) => { if (active) setCount(res.unread_count); })
        .catch(() => {});
      return () => { active = false; };
    }, []),
  );

  return (
    <TouchableOpacity style={style} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
      <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  badge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeTxt: { color: '#fff', fontSize: 9, ...FONTS.bold },
});
