// lib/theme/system-scheme.ts
// The platform's own colour-scheme report, isolated so the theme hook can be
// tested against a controllable OS setting without mocking react-native.
import { Platform, useColorScheme, type ColorSchemeName } from "react-native";

// On web react-native-web reads prefers-color-scheme and re-renders on change.
// RN 0.82 may also report "unspecified"; resolveColorScheme treats anything
// but "dark" as light.
export function useSystemColorScheme(): ColorSchemeName {
  return useColorScheme();
}

export function isWebPlatform(): boolean {
  return Platform.OS === "web";
}
