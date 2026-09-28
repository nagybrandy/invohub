// lib/theme/system-scheme.ts
// The platform's own colour-scheme report, isolated so the theme hook can be
// tested against a controllable OS setting without mocking react-native.
import * as React from "react";
import { Platform, useColorScheme, type ColorSchemeName } from "react-native";

// What the platform may report; "unspecified"/undefined both resolve to light.
export type SystemScheme = ColorSchemeName | null | undefined;

const QUERY = "(prefers-color-scheme: dark)";

function mediaList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(QUERY);
}

function subscribeMedia(onChange: () => void): () => void {
  const media = mediaList();
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readMedia(): SystemScheme {
  const media = mediaList();
  return media ? (media.matches ? "dark" : "light") : undefined;
}

// On web this subscribes to prefers-color-scheme directly, so an OS change
// re-renders the hook without depending on react-native-web's Appearance
// internals. Native uses React Native's own hook. RN 0.82 may also report
// "unspecified"; resolveColorScheme treats anything but "dark" as light.
export function useSystemColorScheme(): SystemScheme {
  const native = useColorScheme();
  const web = React.useSyncExternalStore(subscribeMedia, readMedia, readMedia);
  return isWebPlatform() ? web : native;
}

export function isWebPlatform(): boolean {
  return Platform.OS === "web";
}
