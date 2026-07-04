// lib/theme-preference.ts
// Persists user theme preference in AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "theme-preference";

export type ThemePreference = "light" | "dark" | "system";

export async function loadThemePreference(): Promise<ThemePreference | null> {
  const value = await AsyncStorage.getItem(KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return null;
}

export async function saveThemePreference(value: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEY, value);
}
