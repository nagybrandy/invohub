// app/_layout.tsx
// Root layout: GluestackUIProvider, navigation theme, fonts, and top-level stack routes.
import "react-native-gesture-handler";
import "../global.css";
import "@/lib/i18n";

import * as React from "react";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { hydrateAppLanguage } from "@/lib/i18n/language";
import { designPalette } from "@/lib/theme/tokens";
import { useAppFonts } from "@/lib/ui/use-app-fonts";
import { useColorScheme } from "@/lib/useColorScheme";

export {
  ErrorBoundary,
} from "expo-router";

const InvohubLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: designPalette.light.canvas,
    card: designPalette.light.surface,
    border: designPalette.light["line-strong"],
    primary: designPalette.light.primary,
    text: designPalette.light.ink,
  },
};

const InvohubDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: designPalette.dark.canvas,
    card: designPalette.dark.surface,
    border: designPalette.dark["line-strong"],
    primary: designPalette.dark.primary,
    text: designPalette.dark.ink,
  },
};

export default function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  // Web declares Stack Sans in global.css and is always "loaded"; native loads
  // the static cuts and holds the splash screen until they are ready.
  const fontsReady = useAppFonts();

  React.useEffect(() => {
    void hydrateAppLanguage();
  }, []);

  if (!fontsReady) return null;

  return (
    <GluestackUIProvider mode={colorScheme}>
      <ThemeProvider value={isDarkColorScheme ? InvohubDarkTheme : InvohubLightTheme}>
        <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="blog/index" />
          <Stack.Screen name="blog/[slug]" />
          <Stack.Screen name="developers" />
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="receipts/view" />
          <Stack.Screen name="aszf" />
          <Stack.Screen name="adatkezeles" />
          <Stack.Screen name="cookie-tajekoztato" />
          <Stack.Screen name="impresszum" />
          <Stack.Screen name="(app)" />
        </Stack>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
