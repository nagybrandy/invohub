// app/_layout.tsx
// Root layout: loads Tailwind (global.css), applies navigation theme, mounts the portal host for overlays.
import "../global.css";

import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PortalHost } from "@rn-primitives/portal";
import { useColorScheme } from "@/lib/useColorScheme";

export {
  // Surface navigation errors via Expo Router's error boundary.
  ErrorBoundary,
} from "expo-router";

export default function RootLayout() {
  const { isDarkColorScheme } = useColorScheme();

  return (
    <ThemeProvider value={isDarkColorScheme ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="admin" />
      </Stack>
      <PortalHost />
    </ThemeProvider>
  );
}
