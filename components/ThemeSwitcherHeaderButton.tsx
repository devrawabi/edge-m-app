import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useThemePreference, type ColorSchemePreference } from '@/context/ThemePreferenceContext';

function iconForPreference(p: ColorSchemePreference): keyof typeof Ionicons.glyphMap {
  if (p === 'system') return 'phone-portrait-outline';
  if (p === 'light') return 'sunny-outline';
  return 'moon-outline';
}

export function ThemeSwitcherHeaderButton({ tintColor }: { tintColor: string }) {
  const { preference, cyclePreference } = useThemePreference();

  return (
    <Pressable
      onPress={cyclePreference}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Color theme: ${preference}. Tap to switch.`}
    >
      <Ionicons name={iconForPreference(preference)} size={22} color={tintColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: 4,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
