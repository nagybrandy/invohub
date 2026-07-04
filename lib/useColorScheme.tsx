// lib/useColorScheme.tsx
// Color scheme hook with AsyncStorage persistence for dark mode toggle.
import * as React from "react";
import { useColorScheme as useNativewindColorScheme } from "nativewind";
import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme-preference";

export function useColorScheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } =
    useNativewindColorScheme();
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    void loadThemePreference().then((pref) => {
      if (pref && pref !== "system") {
        setColorScheme(pref);
      }
      setLoaded(true);
    });
  }, [setColorScheme]);

  const setTheme = React.useCallback(
    async (pref: ThemePreference) => {
      await saveThemePreference(pref);
      if (pref === "system") {
        setColorScheme("system");
      } else {
        setColorScheme(pref);
      }
    },
    [setColorScheme]
  );

  const toggleTheme = React.useCallback(async () => {
    const next = colorScheme === "dark" ? "light" : "dark";
    await saveThemePreference(next);
    setColorScheme(next);
  }, [colorScheme, setColorScheme]);

  return {
    colorScheme: colorScheme ?? "light",
    isDarkColorScheme: colorScheme === "dark",
    setColorScheme,
    toggleColorScheme,
    setTheme,
    toggleTheme,
    loaded,
  };
}
