// lib/useColorScheme.tsx
// Colour scheme hook: follows the OS unless the user stored an explicit choice.
//
// The stored preference ("system" | "light" | "dark") lives in AsyncStorage.
// On web the hook resolves "system" itself from prefers-color-scheme (via
// react-native-web's Appearance) and only ever hands nativewind a concrete
// "light"/"dark": nativewind's web runtime treats "system" as "remove the
// dark class" and a <head> observer keeps removing it, so passing "system"
// through leaves the page light under a dark OS. On native nativewind owns
// the Appearance override, so "system" is passed through to clear it.
import * as React from "react";
import { useColorScheme as useNativewindColorScheme } from "nativewind";
import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme-preference";
import { nextThemePreference, resolveColorScheme } from "@/lib/theme/resolve";
import { isWebPlatform, useSystemColorScheme } from "@/lib/theme/system-scheme";

// nativewind refuses setColorScheme when its stylesheet was not compiled with
// darkMode "class" — true for the jest shim, never for the app (tailwind.config
// sets it). Degrade to a warning rather than crash a screen over theming.
function applyScheme(
  setColorScheme: (value: ThemePreference) => void,
  value: ThemePreference,
) {
  try {
    setColorScheme(value);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") console.warn("[theme] could not apply colour scheme", error);
  }
}

export function useColorScheme() {
  const { colorScheme: nativewindScheme, setColorScheme, toggleColorScheme } =
    useNativewindColorScheme();
  const systemScheme = useSystemColorScheme();
  const [preference, setPreference] = React.useState<ThemePreference | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void loadThemePreference().then((pref) => {
      if (cancelled) return;
      setPreference(pref ?? "system");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isWeb = isWebPlatform();
  const effective = resolveColorScheme(
    preference,
    isWeb ? systemScheme : nativewindScheme,
  );

  React.useEffect(() => {
    if (!loaded) return;
    const value = !isWeb && preference === "system" ? "system" : effective;
    applyScheme(setColorScheme, value);
  }, [loaded, isWeb, preference, effective, setColorScheme]);

  const setTheme = React.useCallback(async (pref: ThemePreference) => {
    await saveThemePreference(pref);
    setPreference(pref);
  }, []);

  // Explicit light/dark flip (kept for callers that want a plain switch).
  const toggleTheme = React.useCallback(
    () => setTheme(effective === "dark" ? "light" : "dark"),
    [effective, setTheme]
  );

  // The Settings tile: system → light → dark → system.
  const cycleTheme = React.useCallback(
    () => setTheme(nextThemePreference(preference)),
    [preference, setTheme]
  );

  return {
    colorScheme: effective,
    isDarkColorScheme: effective === "dark",
    preference: preference ?? "system",
    setColorScheme,
    toggleColorScheme,
    setTheme,
    toggleTheme,
    cycleTheme,
    loaded,
  };
}
