import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';

const STORAGE_KEY = 'rawabi_color_scheme_pref_v1';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

function parsePreference(raw: string | null): ColorSchemePreference | null {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return null;
}

async function loadStoredPreference(): Promise<ColorSchemePreference | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      return parsePreference(localStorage.getItem(STORAGE_KEY));
    }
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return parsePreference(raw);
  } catch {
    return null;
  }
}

async function persistPreference(next: ColorSchemePreference): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, next);
  } catch {
    // ignore persistence failures (e.g. private mode)
  }
}

type ThemePreferenceContextValue = {
  preference: ColorSchemePreference;
  setPreference: (next: ColorSchemePreference) => void;
  cyclePreference: () => void;
  /** Resolved appearance for UI (follows OS when preference is `system`). */
  resolvedScheme: 'light' | 'dark';
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function resolveScheme(preference: ColorSchemePreference, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ColorSchemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    void loadStoredPreference().then((parsed) => {
      if (cancelled || !parsed) return;
      setPreferenceState(parsed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ColorSchemePreference) => {
    setPreferenceState(next);
    void persistPreference(next);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((prev) => {
      const order: ColorSchemePreference[] = ['system', 'light', 'dark'];
      const i = order.indexOf(prev);
      const next = order[(i + 1) % order.length];
      void persistPreference(next);
      return next;
    });
  }, []);

  const resolvedScheme = useMemo(
    () => resolveScheme(preference, systemScheme),
    [preference, systemScheme],
  );

  const value = useMemo<ThemePreferenceContextValue>(
    () => ({
      preference,
      setPreference,
      cyclePreference,
      resolvedScheme,
    }),
    [preference, setPreference, cyclePreference, resolvedScheme],
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  }
  return ctx;
}

/** Use for colors and navigation theme (`light` | `dark` only). */
export function useAppColorScheme(): 'light' | 'dark' {
  return useThemePreference().resolvedScheme;
}
