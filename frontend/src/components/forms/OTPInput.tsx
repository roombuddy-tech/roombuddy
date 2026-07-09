import React, { useMemo, useRef, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { RADIUS, FONTS, SPACING, ThemeColors } from '../../constants/theme';
import { useThemeColors } from '../../context/ThemeContext';

interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
}

export default function OTPInput({ length = 6, onComplete }: OTPInputProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);

  const fillAll = (digits: string) => {
    const arr = digits.slice(0, length).split('');
    while (arr.length < length) arr.push('');
    setOtp(arr);
    if (arr.length === length && arr.every(Boolean)) {
      inputs.current[length - 1]?.focus();
      setTimeout(() => onComplete(arr.join('')), 500);
    }
  };

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/[^0-9]/g, '');

    if (digits.length > 1) {
      fillAll(digits);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);

    if (digits && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (digits && index === length - 1) {
      const code = newOtp.join('');
      if (code.length === length) {
        onComplete(code);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  return (
    <View style={styles.container}>
      {Array(length).fill(0).map((_, i) => (
        <TextInput
          key={i}
          ref={(ref) => { inputs.current[i] = ref; }}
          style={[styles.box, otp[i] ? styles.boxFilled : null]}
          value={otp[i]}
          onChangeText={(text) => handleChange(text, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={i === 0 ? length : 1}
          autoFocus={i === 0}
          selectTextOnFocus
          textContentType={i === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={i === 0 ? 'sms-otp' : 'off'}
        />
      ))}
    </View>
  );
}

const makeStyles = (COLORS: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  box: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    textAlign: 'center',
    fontSize: 22,
    color: COLORS.text,
    ...FONTS.bold,
    backgroundColor: COLORS.bg,
  },
  boxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryAlpha,
  },
});
